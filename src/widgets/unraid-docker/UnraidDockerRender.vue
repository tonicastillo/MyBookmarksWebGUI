<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Widget } from '@/types'
import {
  fetchUnraidStatus,
  runUnraidAction,
  type UnraidAction,
  type UnraidContainerInfo
} from '@/api/widgets'

const props = defineProps<{
  widget: Widget
}>()

const status = ref<UnraidContainerInfo | null>(null)
const loading = ref(false)
const actionInFlight = ref<UnraidAction | null>(null)
const error = ref<string | null>(null)

const cfg = computed(() => props.widget.config as {
  serverUrl?: string
  serverLabel?: string
  containerName?: string
  apiToken?: string
})
const hasConfig = computed(() => Boolean(cfg.value.serverUrl && cfg.value.containerName && cfg.value.apiToken))

const stateClass = computed(() => {
  const s = status.value?.state?.toLowerCase()
  if (s === 'running') return 'state-on'
  if (s === 'paused' || s === 'restarting') return 'state-warn'
  if (s === 'not-found') return 'state-err'
  if (error.value) return 'state-err'
  return 'state-off'
})

const isRunning = computed(() => status.value?.state?.toLowerCase() === 'running')

const controlsDisabled = computed(() =>
  loading.value || status.value === null || !!actionInFlight.value
)

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
const cacheKey = computed(() => `unraid-widget:${props.widget.id}`)

const loadFromCache = (): { status: UnraidContainerInfo; lastUpdatedAt: number } | null => {
  try {
    const raw = localStorage.getItem(cacheKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { status?: unknown; lastUpdatedAt?: unknown }
    if (typeof parsed.lastUpdatedAt !== 'number' || !parsed.status || typeof parsed.status !== 'object') return null
    return { status: parsed.status as UnraidContainerInfo, lastUpdatedAt: parsed.lastUpdatedAt }
  } catch {
    return null
  }
}

const saveToCache = () => {
  if (!status.value || lastUpdatedAt.value === null) return
  try {
    localStorage.setItem(cacheKey.value, JSON.stringify({
      status: status.value,
      lastUpdatedAt: lastUpdatedAt.value
    }))
  } catch {
    /* quota / privacy mode — ignorar */
  }
}

const formatPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value >= 10) return `${Math.round(value)}%`
  return `${value.toFixed(1)}%`
}

const cpuText = computed(() => formatPct(status.value?.cpuPercent))
const memText = computed(() => formatPct(status.value?.memPercent))

const refresh = async () => {
  if (!hasConfig.value) return
  loading.value = true
  error.value = null
  try {
    status.value = await fetchUnraidStatus(props.widget.id)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    saveToCache()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error consultando Unraid'
  } finally {
    loading.value = false
  }
}

const doAction = async (action: UnraidAction) => {
  if (!hasConfig.value || actionInFlight.value) return
  actionInFlight.value = action
  error.value = null
  try {
    status.value = await runUnraidAction(props.widget.id, action)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    saveToCache()
  } catch (err) {
    error.value = err instanceof Error ? err.message : `Error en acción ${action}`
  } finally {
    actionInFlight.value = null
  }
}

const scheduleAutoRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (!isVisible.value || !hasConfig.value) return
  const last = lastUpdatedAt.value ?? 0
  const delay = Math.max(0, CACHE_TTL_MS - (Date.now() - last))
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
  const last = lastUpdatedAt.value ?? 0
  if (Date.now() - last >= CACHE_TTL_MS) {
    await refresh()
  }
  scheduleAutoRefresh()
}

const doToggle = () => doAction(isRunning.value ? 'stop' : 'start')

const stopProp = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  const cached = loadFromCache()
  if (cached) {
    status.value = cached.status
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
  <div ref="rootRef" class="unr-render" @click="stopProp">
    <div v-if="!hasConfig" class="unr-warn">
      Widget Unraid sin configurar. Edita el bookmark para añadir servidor, contenedor y token.
    </div>

    <template v-else>
      <div class="unr-head">
        <span class="unr-server">{{ cfg.serverLabel || 'Unraid' }}</span>
        <span v-if="elapsedText" class="unr-elapsed" :title="`Última actualización hace ${elapsedText}`">{{ elapsedText }}</span>
        <button
          type="button"
          class="unr-refresh"
          :disabled="loading"
          title="Refrescar estado"
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

      <div class="unr-metrics">
        <div class="unr-metric">
          <span class="unr-metric-label">CPU</span>
          <span class="unr-metric-value">{{ cpuText }}</span>
        </div>
        <div class="unr-metric">
          <span class="unr-metric-label">RAM</span>
          <span class="unr-metric-value">{{ memText }}</span>
        </div>
      </div>

      <div v-if="error" class="unr-error">{{ error }}</div>

      <div class="unr-actions">
        <button
          type="button"
          class="unr-btn unr-toggle"
          :class="stateClass"
          :disabled="controlsDisabled"
          :title="isRunning ? 'Detener' : 'Arrancar'"
          :aria-label="isRunning ? 'Detener' : 'Arrancar'"
          @click.stop="doToggle"
        >
          <svg v-if="actionInFlight === 'start' || actionInFlight === 'stop'" class="unr-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <svg v-else-if="isRunning" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 7 5.5z" />
          </svg>
        </button>

        <button
          type="button"
          class="unr-btn unr-restart"
          :class="stateClass"
          :disabled="controlsDisabled || !isRunning"
          title="Reiniciar"
          aria-label="Reiniciar"
          @click.stop="doAction('restart')"
        >
          <svg v-if="actionInFlight === 'restart'" class="unr-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.unr-render {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  font-size: 11.5px;
}

.unr-warn {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
}

.unr-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.unr-server {
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

.unr-elapsed {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--fg-faint, #a8a294);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.unr-refresh {
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
.unr-refresh:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.unr-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

.unr-metrics {
  display: flex;
  gap: 14px;
  padding: 2px 2px 0;
}
.unr-metric {
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.unr-metric-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.unr-metric-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg, #1c1a14);
  font-variant-numeric: tabular-nums;
}

.unr-error {
  font-size: 10.5px;
  color: #b85248;
  background: rgba(184, 82, 72, 0.08);
  padding: 4px 6px;
  border-radius: 4px;
  word-break: break-word;
}

.unr-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.unr-btn {
  height: 30px;
  display: grid;
  place-items: center;
  font: inherit;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.unr-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.unr-toggle { flex: 2; }
.unr-restart { flex: 1; }

.unr-btn.state-on {
  background: rgba(56, 161, 105, 0.12);
  border-color: rgba(56, 161, 105, 0.4);
  color: #2f855a;
}
.unr-btn.state-on:hover:not(:disabled) {
  background: rgba(56, 161, 105, 0.2);
}

.unr-btn.state-off {
  background: var(--bg-elev, #ffffff);
  border-color: rgba(160, 174, 192, 0.45);
  color: var(--fg-soft, #7a7468);
}
.unr-btn.state-off:hover:not(:disabled) {
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
}

.unr-btn.state-warn {
  background: rgba(214, 158, 46, 0.12);
  border-color: rgba(214, 158, 46, 0.4);
  color: #b7791f;
}
.unr-btn.state-warn:hover:not(:disabled) {
  background: rgba(214, 158, 46, 0.2);
}

.unr-btn.state-err {
  background: rgba(184, 82, 72, 0.1);
  border-color: rgba(184, 82, 72, 0.4);
  color: #b85248;
}
.unr-btn.state-err:hover:not(:disabled) {
  background: rgba(184, 82, 72, 0.18);
}

.unr-spin {
  animation: unr-spin 0.9s linear infinite;
}
@keyframes unr-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
