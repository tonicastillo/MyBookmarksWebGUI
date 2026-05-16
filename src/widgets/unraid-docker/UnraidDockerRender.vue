<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const cfg = computed(() => props.widget.config as { serverUrl?: string; containerName?: string; apiToken?: string })
const hasConfig = computed(() => Boolean(cfg.value.serverUrl && cfg.value.containerName && cfg.value.apiToken))

const stateLabel = computed(() => {
  const s = status.value?.state?.toLowerCase()
  if (!s) return '—'
  if (s === 'running') return 'Activo'
  if (s === 'exited' || s === 'stopped' || s === 'created') return 'Parado'
  if (s === 'paused') return 'Pausado'
  if (s === 'restarting') return 'Reiniciando'
  if (s === 'not-found') return 'No encontrado'
  return s
})

const stateClass = computed(() => {
  const s = status.value?.state?.toLowerCase()
  if (s === 'running') return 'state-on'
  if (s === 'paused' || s === 'restarting') return 'state-warn'
  if (s === 'not-found') return 'state-err'
  return 'state-off'
})

const isRunning = computed(() => status.value?.state?.toLowerCase() === 'running')

const formatBytes = (bytes: number | null): string | null => {
  if (bytes === null || bytes === undefined) return null
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`
}

const sizeText = computed(() => formatBytes(status.value?.sizeRootFs ?? null))

const refresh = async () => {
  if (!hasConfig.value) return
  loading.value = true
  error.value = null
  try {
    status.value = await fetchUnraidStatus(props.widget.id)
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
  } catch (err) {
    error.value = err instanceof Error ? err.message : `Error en acción ${action}`
  } finally {
    actionInFlight.value = null
  }
}

const stopProp = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  if (hasConfig.value) refresh()
})
</script>

<template>
  <div class="unr-render" @click="stopProp">
    <div v-if="!hasConfig" class="unr-warn">
      Widget Unraid sin configurar. Edita el bookmark para añadir servidor, contenedor y token.
    </div>

    <template v-else>
      <div class="unr-head">
        <div class="unr-title">
          <span class="unr-dot" :class="stateClass" />
          <span class="unr-name">{{ status?.name ?? cfg.containerName }}</span>
          <span class="unr-state-label">{{ stateLabel }}</span>
        </div>
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

      <div v-if="status?.image" class="unr-meta">
        <span class="unr-label">imagen</span> {{ status.image }}
      </div>
      <div v-if="status?.status && status.status !== status.state" class="unr-meta">
        {{ status.status }}
      </div>
      <div v-if="sizeText" class="unr-meta">
        <span class="unr-label">tamaño</span> {{ sizeText }}
      </div>

      <div v-if="error" class="unr-error">{{ error }}</div>

      <div class="unr-actions">
        <button
          type="button"
          class="unr-btn unr-btn-start"
          :disabled="isRunning || !!actionInFlight"
          @click.stop="doAction('start')"
        >
          {{ actionInFlight === 'start' ? '…' : 'Start' }}
        </button>
        <button
          type="button"
          class="unr-btn unr-btn-stop"
          :disabled="!isRunning || !!actionInFlight"
          @click.stop="doAction('stop')"
        >
          {{ actionInFlight === 'stop' ? '…' : 'Stop' }}
        </button>
        <button
          type="button"
          class="unr-btn unr-btn-restart"
          :disabled="!isRunning || !!actionInFlight"
          @click.stop="doAction('restart')"
        >
          {{ actionInFlight === 'restart' ? '…' : 'Restart' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.unr-render {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
.unr-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.unr-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.unr-dot.state-on { background: #38a169; box-shadow: 0 0 0 2px rgba(56, 161, 105, 0.18); }
.unr-dot.state-off { background: #a0aec0; }
.unr-dot.state-warn { background: #d69e2e; }
.unr-dot.state-err { background: #b85248; }

.unr-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--fg, #1c1a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.unr-state-label {
  font-size: 10px;
  color: var(--fg-faint, #a8a294);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

.unr-meta {
  font-size: 10.5px;
  color: var(--fg-soft, #7a7468);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unr-label {
  font-size: 9.5px;
  color: var(--fg-faint, #a8a294);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 4px;
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
  gap: 4px;
  margin-top: 2px;
}
.unr-btn {
  flex: 1;
  height: 26px;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
}
.unr-btn:hover:not(:disabled) { background: var(--bg, #faf9f7); }
.unr-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.unr-btn-start:not(:disabled) { color: #2f855a; border-color: rgba(47, 133, 90, 0.3); }
.unr-btn-stop:not(:disabled) { color: #b85248; border-color: rgba(184, 82, 72, 0.3); }
.unr-btn-restart:not(:disabled) { color: #4a463c; }
</style>
