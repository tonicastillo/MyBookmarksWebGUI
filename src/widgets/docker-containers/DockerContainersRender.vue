<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Widget } from '@/types'
import {
  fetchDockerContainers,
  runDockerAction,
  type DockerAction,
  type DockerContainer
} from '@/api/widgets'
import { useCredentialsStore } from '@/stores/credentials'

const props = defineProps<{
  widget: Widget
}>()

const credentialsStore = useCredentialsStore()

const CPU_WARN = 70
const CPU_CRIT = 90

const containers = ref<DockerContainer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showStopped = ref(false)
// Contenedor con una acción en vuelo: `${id}:${action}`
const busyKey = ref<string | null>(null)

const cfg = computed(() => props.widget.config as {
  credentialId?: string
  serverLabel?: string
})
const credential = computed(() =>
  cfg.value.credentialId ? credentialsStore.byId(cfg.value.credentialId) : undefined
)
const resolvedLabel = computed(() => {
  if (cfg.value.serverLabel) return cfg.value.serverLabel
  const credData = credential.value?.data as { serverLabel?: unknown } | undefined
  if (credData && typeof credData.serverLabel === 'string' && credData.serverLabel) {
    return credData.serverLabel
  }
  return credential.value?.name ?? 'Docker'
})
const hasConfig = computed(() => Boolean(cfg.value.credentialId))

const isRunning = (c: DockerContainer): boolean =>
  typeof c.state === 'string' && c.state.toLowerCase() === 'running'

const running = computed(() =>
  containers.value
    .filter(isRunning)
    .sort((a, b) => (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1))
)
const stopped = computed(() => containers.value.filter((c) => !isRunning(c)))

const cpuClass = (cpu: number | null): string => {
  if (cpu === null || !Number.isFinite(cpu)) return ''
  if (cpu >= CPU_CRIT) return 'cpu-crit'
  if (cpu >= CPU_WARN) return 'cpu-warn'
  return ''
}

const formatPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value >= 10) return `${Math.round(value)}%`
  return `${value.toFixed(1)}%`
}

const lastUpdatedAt = ref<number | null>(null)
const nowMs = ref(Date.now())

const elapsedText = computed(() => {
  if (lastUpdatedAt.value === null) return null
  const sec = Math.max(0, Math.floor((nowMs.value - lastUpdatedAt.value) / 1000))
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  return `${Math.floor(hr / 24)}d`
})

let tickHandle: ReturnType<typeof setInterval> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | null = null
const rootRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const CACHE_TTL_MS = 5 * 60 * 1000
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000]
const lastAttemptedAt = ref<number | null>(null)
let consecutiveFailures = 0
const cacheKey = computed(() => `docker-list-widget:${props.widget.id}`)

const friendlyError = (msg: string): string => {
  if (/ECONNREFUSED/i.test(msg)) return 'Servidor no accesible'
  if (/ETIMEDOUT|ECONNABORTED|timeout/i.test(msg)) return 'Tiempo de espera agotado'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 'No se encuentra el servidor'
  if (/ECONNRESET|socket hang up/i.test(msg)) return 'Conexión interrumpida'
  if (/HTTP 401|Unauthorized/i.test(msg)) return 'Credenciales inválidas'
  if (/Graphql is offline/i.test(msg)) return 'GraphQL del servidor desactivado'
  if (/HTTP 5\d\d/.test(msg)) return 'Error en el servidor'
  return msg
}

const loadFromCache = (): { containers: DockerContainer[]; lastUpdatedAt: number } | null => {
  try {
    const raw = localStorage.getItem(cacheKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { containers?: unknown; lastUpdatedAt?: unknown }
    if (typeof parsed.lastUpdatedAt !== 'number' || !Array.isArray(parsed.containers)) return null
    return { containers: parsed.containers as DockerContainer[], lastUpdatedAt: parsed.lastUpdatedAt }
  } catch {
    return null
  }
}

const saveToCache = () => {
  if (lastUpdatedAt.value === null) return
  try {
    localStorage.setItem(cacheKey.value, JSON.stringify({
      containers: containers.value,
      lastUpdatedAt: lastUpdatedAt.value
    }))
  } catch {
    /* quota / privacy mode — ignorar */
  }
}

const refresh = async () => {
  if (!hasConfig.value) return
  loading.value = true
  error.value = null
  try {
    containers.value = await fetchDockerContainers(props.widget.id)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    consecutiveFailures = 0
    saveToCache()
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Error consultando el servidor'
    error.value = friendlyError(raw)
    consecutiveFailures += 1
  } finally {
    lastAttemptedAt.value = Date.now()
    loading.value = false
  }
}

const doAction = async (container: DockerContainer, action: DockerAction) => {
  if (!hasConfig.value || !container.id || busyKey.value) return
  busyKey.value = `${container.id}:${action}`
  error.value = null
  try {
    containers.value = await runDockerAction(props.widget.id, container.id, action)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    consecutiveFailures = 0
    saveToCache()
  } catch (err) {
    const raw = err instanceof Error ? err.message : `Error en acción ${action}`
    error.value = friendlyError(raw)
  } finally {
    busyKey.value = null
  }
}

const nextIntervalMs = (): number => {
  if (consecutiveFailures === 0) return CACHE_TTL_MS
  const idx = Math.min(consecutiveFailures - 1, RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[idx]
}

const scheduleAutoRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (!isVisible.value || !hasConfig.value) return
  const last = lastAttemptedAt.value ?? lastUpdatedAt.value ?? 0
  const delay = Math.max(0, nextIntervalMs() - (Date.now() - last))
  refreshTimer = setTimeout(async () => {
    if (!isVisible.value) return
    await refresh()
    scheduleAutoRefresh()
  }, delay)
}

const handleVisibility = async (visible: boolean) => {
  isVisible.value = visible
  if (!visible) {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = undefined
    return
  }
  if (!hasConfig.value) return
  const last = lastAttemptedAt.value ?? lastUpdatedAt.value ?? 0
  if (Date.now() - last >= nextIntervalMs()) {
    await refresh()
  }
  scheduleAutoRefresh()
}

const stopProp = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  const cached = loadFromCache()
  if (cached) {
    containers.value = cached.containers
    lastUpdatedAt.value = cached.lastUpdatedAt
    nowMs.value = Date.now()
  }

  tickHandle = setInterval(() => { nowMs.value = Date.now() }, 1000)

  if (!hasConfig.value) return

  if (rootRef.value && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting)
        handleVisibility(visible)
      },
      { rootMargin: '300px 0px' }
    )
    observer.observe(rootRef.value)
  } else {
    handleVisibility(true)
  }
})

onBeforeUnmount(() => {
  if (tickHandle) clearInterval(tickHandle)
  if (refreshTimer) clearTimeout(refreshTimer)
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<template>
  <div ref="rootRef" class="dkc-render" @click="stopProp">
    <div v-if="!hasConfig" class="dkc-warn">
      Widget Docker sin configurar. Edita el bookmark para asignar una conexión.
    </div>

    <template v-else>
      <div class="dkc-head">
        <span class="dkc-server">{{ resolvedLabel }}</span>
        <span class="dkc-count">{{ running.length }} activos</span>
        <span v-if="elapsedText" class="dkc-elapsed" :title="`Última actualización hace ${elapsedText}`">{{ elapsedText }}</span>
        <button
          type="button"
          class="dkc-refresh"
          :disabled="loading"
          title="Refrescar"
          aria-label="Refrescar"
          @click.stop="refresh"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <div v-if="error" class="dkc-error">{{ error }}</div>

      <ul v-if="running.length > 0" class="dkc-list">
        <li v-for="c in running" :key="c.id ?? c.name" class="dkc-row" :class="cpuClass(c.cpuPercent)">
          <span class="dkc-dot" />
          <span class="dkc-name" :title="c.name">{{ c.name }}</span>
          <span class="dkc-cpu" :class="cpuClass(c.cpuPercent)">{{ formatPct(c.cpuPercent) }}</span>
          <span class="dkc-row-actions">
            <button
              type="button"
              class="dkc-act"
              :disabled="!!busyKey"
              title="Reiniciar"
              aria-label="Reiniciar"
              @click.stop="doAction(c, 'restart')"
            >
              <svg v-if="busyKey === `${c.id}:restart`" class="dkc-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <button
              type="button"
              class="dkc-act dkc-stop"
              :disabled="!!busyKey"
              title="Detener"
              aria-label="Detener"
              @click.stop="doAction(c, 'stop')"
            >
              <svg v-if="busyKey === `${c.id}:stop`" class="dkc-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          </span>
        </li>
      </ul>

      <div v-else-if="!error" class="dkc-empty">Sin contenedores en ejecución.</div>

      <div v-if="stopped.length > 0" class="dkc-stopped">
        <button type="button" class="dkc-toggle" @click.stop="showStopped = !showStopped">
          <svg
            class="dkc-chevron"
            :class="{ open: showStopped }"
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Detenidos ({{ stopped.length }})
        </button>

        <ul v-if="showStopped" class="dkc-list">
          <li v-for="c in stopped" :key="c.id ?? c.name" class="dkc-row dkc-off">
            <span class="dkc-dot" />
            <span class="dkc-name" :title="c.name">{{ c.name }}</span>
            <span class="dkc-state">{{ c.state ?? '—' }}</span>
            <span class="dkc-row-actions">
              <button
                type="button"
                class="dkc-act dkc-start"
                :disabled="!!busyKey || !c.id"
                title="Arrancar"
                aria-label="Arrancar"
                @click.stop="doAction(c, 'start')"
              >
                <svg v-if="busyKey === `${c.id}:start`" class="dkc-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 7 5.5z" />
                </svg>
              </button>
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dkc-render {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  font-size: 11.5px;
}

.dkc-warn {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
}

.dkc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dkc-server {
  flex: 1;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dkc-count {
  font-size: 10px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.dkc-elapsed {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--fg-faint, #a8a294);
  flex-shrink: 0;
}
.dkc-refresh {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  flex-shrink: 0;
}
.dkc-refresh:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.dkc-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

.dkc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dkc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.06));
}
.dkc-row.cpu-warn {
  background: rgba(214, 158, 46, 0.1);
  border-color: rgba(214, 158, 46, 0.35);
}
.dkc-row.cpu-crit {
  background: rgba(184, 82, 72, 0.12);
  border-color: rgba(184, 82, 72, 0.4);
}
.dkc-row.dkc-off { opacity: 0.75; }

.dkc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38a169;
  flex-shrink: 0;
}
.dkc-off .dkc-dot { background: var(--fg-faint, #a8a294); }
.cpu-warn .dkc-dot { background: #d69e2e; }
.cpu-crit .dkc-dot { background: #b85248; }

.dkc-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg, #1c1a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dkc-cpu {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg, #1c1a14);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.dkc-cpu.cpu-warn { color: #b7791f; }
.dkc-cpu.cpu-crit { color: #b85248; }
.dkc-state {
  font-size: 10.5px;
  color: var(--fg-faint, #a8a294);
  flex-shrink: 0;
  text-transform: capitalize;
}

.dkc-row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.dkc-act {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.14));
  background: var(--bg, #faf9f7);
  color: var(--fg-soft, #7a7468);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.dkc-act:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.dkc-act:disabled { opacity: 0.45; cursor: not-allowed; }
.dkc-stop:hover:not(:disabled) { color: #b85248; }
.dkc-start:hover:not(:disabled) { color: #2f855a; }

.dkc-error {
  font-size: 10.5px;
  color: #b85248;
  background: rgba(184, 82, 72, 0.08);
  padding: 4px 6px;
  border-radius: 4px;
  word-break: break-word;
}
.dkc-empty {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
  padding: 2px;
}

.dkc-stopped {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}
.dkc-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 0;
  padding: 4px 2px;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
}
.dkc-toggle:hover { color: var(--fg-mid, #4a463c); }
.dkc-chevron {
  transition: transform 150ms ease;
}
.dkc-chevron.open { transform: rotate(90deg); }

.dkc-spin {
  animation: dkc-spin 0.9s linear infinite;
}
@keyframes dkc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
