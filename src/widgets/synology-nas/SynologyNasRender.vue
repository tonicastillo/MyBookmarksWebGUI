<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Widget } from '@/types'
import {
  fetchSynologyStatus,
  rebootSynology,
  type SynologyStatus,
  type SynologyVolume
} from '@/api/widgets'

interface SynologyConfig {
  credentialId?: string
  title?: string
  pollIntervalSec?: number
  diskWarnPercent?: number
}

const props = defineProps<{
  widget: Widget
}>()

const cfg = computed<SynologyConfig>(() => props.widget.config as SynologyConfig)
const pollSec = computed(() => {
  const v = cfg.value.pollIntervalSec
  if (typeof v !== 'number' || !Number.isFinite(v)) return 10
  return Math.max(5, Math.round(v))
})
const warnPercent = computed(() => {
  const v = cfg.value.diskWarnPercent
  if (typeof v !== 'number' || !Number.isFinite(v)) return 85
  return Math.min(100, Math.max(50, Math.round(v)))
})
const hasConfig = computed(() => Boolean(cfg.value.credentialId))

const status = ref<SynologyStatus | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const lastUpdatedAt = ref<number | null>(null)
const nowMs = ref(Date.now())

const confirmingReboot = ref(false)
const rebooting = ref(false)
const rebootDone = ref(false)

let tickHandle: ReturnType<typeof setInterval> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | null = null
const rootRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const cacheKey = computed(() => `synology-widget:${props.widget.id}`)

const loadFromCache = (): { status: SynologyStatus; lastUpdatedAt: number } | null => {
  try {
    const raw = localStorage.getItem(cacheKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { status?: unknown; lastUpdatedAt?: unknown }
    if (typeof parsed.lastUpdatedAt !== 'number' || typeof parsed.status !== 'object' || parsed.status === null) {
      return null
    }
    return { status: parsed.status as SynologyStatus, lastUpdatedAt: parsed.lastUpdatedAt }
  } catch {
    return null
  }
}

const saveToCache = (): void => {
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

const refresh = async (): Promise<void> => {
  if (!hasConfig.value || rebooting.value || rebootDone.value) return
  loading.value = true
  error.value = null
  try {
    status.value = await fetchSynologyStatus(props.widget.id)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    saveToCache()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error consultando el NAS'
  } finally {
    loading.value = false
  }
}

const askReboot = (): void => {
  confirmingReboot.value = true
}

const cancelReboot = (): void => {
  confirmingReboot.value = false
}

const doReboot = async (): Promise<void> => {
  if (rebooting.value) return
  confirmingReboot.value = false
  rebooting.value = true
  error.value = null
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = undefined
  try {
    await rebootSynology(props.widget.id)
    rebootDone.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error reiniciando el NAS'
  } finally {
    rebooting.value = false
  }
}

const scheduleAutoRefresh = (): void => {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (!isVisible.value || !hasConfig.value) return
  refreshTimer = setTimeout(async () => {
    if (!isVisible.value) return
    await refresh()
    scheduleAutoRefresh()
  }, pollSec.value * 1000)
}

const handleVisibility = async (visible: boolean): Promise<void> => {
  isVisible.value = visible
  if (!visible) {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = undefined
    return
  }
  if (!hasConfig.value) return
  const last = lastUpdatedAt.value ?? 0
  if (Date.now() - last >= pollSec.value * 1000) {
    await refresh()
  }
  scheduleAutoRefresh()
}

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

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const decimals = value >= 100 || unit <= 1 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unit]}`
}

const volumeIsWarning = (vol: SynologyVolume): boolean =>
  vol.usedPercent >= warnPercent.value || (vol.status !== '' && vol.status !== 'normal')

const stopProp = (event: Event): void => {
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
  <div ref="rootRef" class="syno-render" @click="stopProp">
    <div v-if="!hasConfig" class="syno-warn">
      Widget Synology sin configurar. Edita el bookmark para asignar una credencial.
    </div>

    <template v-else>
      <div class="syno-head">
        <span class="syno-title">{{ cfg.title || 'Synology NAS' }}</span>
        <span v-if="elapsedText" class="syno-elapsed" :title="`Última actualización hace ${elapsedText}`">{{ elapsedText }}</span>
        <button
          type="button"
          class="syno-refresh"
          :disabled="loading || rebooting"
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

      <div v-if="rebootDone" class="syno-rebooting">
        El NAS se está reiniciando. Tardará unos minutos en volver a estar disponible.
      </div>

      <div v-if="error" class="syno-error">{{ error }}</div>

      <template v-if="status">
        <div class="syno-metrics">
          <div class="metric">
            <div class="metric-head">
              <span class="metric-label">CPU</span>
              <span class="metric-value">{{ status.cpuPercent }}%</span>
            </div>
            <div class="bar"><div class="bar-fill" :class="{ high: status.cpuPercent >= 90 }" :style="{ width: `${status.cpuPercent}%` }" /></div>
          </div>
          <div class="metric">
            <div class="metric-head">
              <span class="metric-label">Memoria</span>
              <span class="metric-value">{{ status.memPercent }}%</span>
            </div>
            <div class="bar"><div class="bar-fill" :class="{ high: status.memPercent >= 90 }" :style="{ width: `${status.memPercent}%` }" /></div>
          </div>
        </div>

        <ul v-if="status.volumes.length > 0" class="syno-volumes">
          <li v-for="vol in status.volumes" :key="vol.id" class="volume" :class="{ warn: volumeIsWarning(vol) }">
            <div class="volume-head">
              <span class="volume-name" :title="vol.status">{{ vol.name }}</span>
              <span class="volume-free">{{ formatBytes(vol.freeBytes) }} libres</span>
            </div>
            <div class="bar">
              <div class="bar-fill" :class="{ high: volumeIsWarning(vol) }" :style="{ width: `${vol.usedPercent}%` }" />
            </div>
            <div class="volume-sub">
              <span>{{ vol.usedPercent }}% usado · {{ formatBytes(vol.usedBytes) }} / {{ formatBytes(vol.totalBytes) }}</span>
              <span v-if="vol.status && vol.status !== 'normal'" class="volume-status">{{ vol.status }}</span>
            </div>
          </li>
        </ul>
      </template>

      <div class="syno-foot">
        <template v-if="!confirmingReboot">
          <button
            type="button"
            class="reboot-btn"
            :disabled="rebooting || rebootDone"
            @click.stop="askReboot"
          >
            <svg v-if="rebooting" class="syno-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>{{ rebooting ? 'Reiniciando…' : 'Reiniciar NAS' }}</span>
          </button>
        </template>
        <template v-else>
          <span class="confirm-text">¿Reiniciar el NAS?</span>
          <button type="button" class="confirm-btn yes" @click.stop="doReboot">Sí, reiniciar</button>
          <button type="button" class="confirm-btn no" @click.stop="cancelReboot">Cancelar</button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.syno-render {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  font-size: 11.5px;
}

.syno-warn {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
}

.syno-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.syno-title {
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
.syno-elapsed {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--fg-faint, #a8a294);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.syno-refresh {
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
.syno-refresh:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.syno-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

.syno-error {
  font-size: 10.5px;
  color: #b85248;
  background: rgba(184, 82, 72, 0.08);
  padding: 4px 6px;
  border-radius: 4px;
  word-break: break-word;
}
.syno-rebooting {
  font-size: 10.5px;
  color: #b07a3a;
  background: rgba(176, 122, 58, 0.1);
  padding: 4px 6px;
  border-radius: 4px;
}

.syno-metrics {
  display: flex;
  gap: 10px;
}
.metric { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.metric-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.metric-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.metric-value {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--fg, #1c1a14);
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(28, 26, 20, 0.08);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  background: #2f855a;
  transition: width 0.4s ease;
}
.bar-fill.high { background: #b85248; }

.syno-volumes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.volume {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.volume.warn {
  border-color: rgba(184, 82, 72, 0.4);
  background: rgba(184, 82, 72, 0.05);
}
.volume-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.volume-name {
  font-size: 12px;
  color: var(--fg, #1c1a14);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.volume-free {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--fg-mid, #4a463c);
  flex-shrink: 0;
}
.volume-sub {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
}
.volume-status {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #b85248;
  font-weight: 600;
  flex-shrink: 0;
}

.syno-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.reboot-btn {
  height: 26px;
  padding: 0 10px;
  font: inherit;
  font-size: 11px;
  border-radius: 5px;
  border: 0.5px solid rgba(184, 82, 72, 0.4);
  background: transparent;
  color: #b85248;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.reboot-btn:hover:not(:disabled) { background: rgba(184, 82, 72, 0.08); }
.reboot-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.confirm-text {
  font-size: 11px;
  color: var(--fg, #1c1a14);
  font-weight: 500;
}
.confirm-btn {
  height: 26px;
  padding: 0 10px;
  font: inherit;
  font-size: 11px;
  border-radius: 5px;
  cursor: pointer;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.confirm-btn.yes {
  border-color: rgba(184, 82, 72, 0.5);
  background: #b85248;
  color: #fff;
}
.confirm-btn.yes:hover { background: #a3463d; }
.confirm-btn.no:hover { background: var(--bg-soft, #f3f1ec); }

.syno-spin { animation: syno-spin 0.9s linear infinite; }
@keyframes syno-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
