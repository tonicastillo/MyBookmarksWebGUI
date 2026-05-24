<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Widget } from '@/types'
import {
  fetchHomeAssistantState,
  runHomeAssistantAction,
  type HomeAssistantEntityState
} from '@/api/widgets'
import Icon from '@/components/Icon.vue'

interface HaAction {
  label?: string
  icon?: string | null
  domain?: string
  service?: string
  serviceData?: Record<string, unknown>
}

interface HaEntity {
  entityId?: string
  label?: string
  icon?: string | null
  actions?: HaAction[]
}

interface HaConfig {
  credentialId?: string
  title?: string
  pollIntervalSec?: number
  entities?: HaEntity[]
}

const props = defineProps<{
  widget: Widget
}>()

const cfg = computed<HaConfig>(() => props.widget.config as HaConfig)
const configuredEntities = computed<HaEntity[]>(() =>
  Array.isArray(cfg.value.entities) ? cfg.value.entities : []
)
const pollSec = computed(() => {
  const v = cfg.value.pollIntervalSec
  if (typeof v !== 'number' || !Number.isFinite(v)) return 10
  return Math.max(5, Math.round(v))
})
const hasConfig = computed(() => Boolean(cfg.value.credentialId && configuredEntities.value.length > 0))

const states = ref<HomeAssistantEntityState[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const actionInFlight = ref<string | null>(null)
const lastUpdatedAt = ref<number | null>(null)
const nowMs = ref(Date.now())

let tickHandle: ReturnType<typeof setInterval> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let observer: IntersectionObserver | null = null
const rootRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const cacheKey = computed(() => `home-assistant-widget:${props.widget.id}`)

const loadFromCache = (): { states: HomeAssistantEntityState[]; lastUpdatedAt: number } | null => {
  try {
    const raw = localStorage.getItem(cacheKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { states?: unknown; lastUpdatedAt?: unknown }
    if (typeof parsed.lastUpdatedAt !== 'number' || !Array.isArray(parsed.states)) return null
    return { states: parsed.states as HomeAssistantEntityState[], lastUpdatedAt: parsed.lastUpdatedAt }
  } catch {
    return null
  }
}

const saveToCache = (): void => {
  if (states.value.length === 0 || lastUpdatedAt.value === null) return
  try {
    localStorage.setItem(cacheKey.value, JSON.stringify({
      states: states.value,
      lastUpdatedAt: lastUpdatedAt.value
    }))
  } catch {
    /* quota / privacy mode — ignorar */
  }
}

const refresh = async (): Promise<void> => {
  if (!hasConfig.value) return
  loading.value = true
  error.value = null
  try {
    states.value = await fetchHomeAssistantState(props.widget.id)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    saveToCache()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error consultando Home Assistant'
  } finally {
    loading.value = false
  }
}

const doAction = async (entityIdx: number, actionIdx: number): Promise<void> => {
  const key = `${entityIdx}:${actionIdx}`
  if (actionInFlight.value) return
  actionInFlight.value = key
  error.value = null
  try {
    states.value = await runHomeAssistantAction(props.widget.id, entityIdx, actionIdx)
    lastUpdatedAt.value = Date.now()
    nowMs.value = lastUpdatedAt.value
    saveToCache()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error ejecutando acción'
  } finally {
    actionInFlight.value = null
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

const entityLabel = (cfgEntity: HaEntity, state: HomeAssistantEntityState | undefined): string => {
  if (cfgEntity.label) return cfgEntity.label
  const friendly = state?.attributes?.['friendly_name']
  if (typeof friendly === 'string' && friendly) return friendly
  return cfgEntity.entityId ?? ''
}

const formatState = (state: HomeAssistantEntityState | undefined): string => {
  if (!state) return '—'
  if (state.error) return '⚠'
  if (state.state === null || state.state === undefined || state.state === '') return '—'
  const unit = state.attributes?.['unit_of_measurement']
  if (typeof unit === 'string' && unit) return `${state.state} ${unit}`
  return state.state
}

const stateClass = (state: HomeAssistantEntityState | undefined): string => {
  if (!state) return 'state-unknown'
  if (state.error) return 'state-err'
  const s = (state.state ?? '').toLowerCase()
  if (s === 'on' || s === 'open' || s === 'home' || s === 'active' || s === 'playing') return 'state-on'
  if (s === 'off' || s === 'closed' || s === 'not_home' || s === 'idle' || s === 'paused') return 'state-off'
  if (s === 'unavailable' || s === 'unknown') return 'state-unknown'
  return 'state-neutral'
}

const stopProp = (event: Event): void => {
  event.preventDefault()
  event.stopPropagation()
}

const stateByEntityId = computed(() => {
  const map = new Map<string, HomeAssistantEntityState>()
  for (const s of states.value) {
    map.set(s.entityId, s)
  }
  return map
})

onMounted(() => {
  const cached = loadFromCache()
  if (cached) {
    states.value = cached.states
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
  <div ref="rootRef" class="ha-render" @click="stopProp">
    <div v-if="!hasConfig" class="ha-warn">
      Widget Home Assistant sin configurar. Edita el bookmark para asignar credencial y entidades.
    </div>

    <template v-else>
      <div class="ha-head">
        <span class="ha-title">{{ cfg.title || 'Home Assistant' }}</span>
        <span v-if="elapsedText" class="ha-elapsed" :title="`Última actualización hace ${elapsedText}`">{{ elapsedText }}</span>
        <button
          type="button"
          class="ha-refresh"
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

      <div v-if="error" class="ha-error">{{ error }}</div>

      <ul class="ha-list">
        <li v-for="(entity, eIdx) in configuredEntities" :key="entity.entityId ?? eIdx" class="ha-row">
          <div class="ha-row-info">
            <Icon
              v-if="entity.icon"
              :name="entity.icon"
              :size="14"
              class="ha-entity-icon"
              :title="entity.entityId"
            />
            <span v-if="entity.label" class="ha-label" :title="entity.entityId">{{ entity.label }}</span>
            <span v-else-if="!entity.icon" class="ha-label" :title="entity.entityId">{{ entityLabel(entity, stateByEntityId.get(entity.entityId ?? '')) }}</span>
            <span
              class="ha-state"
              :class="stateClass(stateByEntityId.get(entity.entityId ?? ''))"
              :title="stateByEntityId.get(entity.entityId ?? '')?.error ?? ''"
            >
              {{ formatState(stateByEntityId.get(entity.entityId ?? '')) }}
            </span>
          </div>
          <div v-if="(entity.actions ?? []).length > 0" class="ha-actions">
            <button
              v-for="(action, aIdx) in entity.actions ?? []"
              :key="aIdx"
              type="button"
              class="ha-action-btn"
              :class="{ 'icon-only': !!action.icon && !action.label }"
              :disabled="actionInFlight !== null"
              :title="action.label || `${action.domain}.${action.service}`"
              :aria-label="action.label || `${action.domain}.${action.service}`"
              @click.stop="doAction(eIdx, aIdx)"
            >
              <svg v-if="actionInFlight === `${eIdx}:${aIdx}`" class="ha-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <template v-else>
                <Icon v-if="action.icon" :name="action.icon" :size="12" />
                <span v-if="action.label">{{ action.label }}</span>
                <span v-else-if="!action.icon">{{ action.domain }}.{{ action.service }}</span>
              </template>
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.ha-render {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  font-size: 11.5px;
}

.ha-warn {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
}

.ha-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ha-title {
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
.ha-elapsed {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--fg-faint, #a8a294);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}
.ha-refresh {
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
.ha-refresh:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
}
.ha-refresh:disabled { opacity: 0.4; cursor: not-allowed; }

.ha-error {
  font-size: 10.5px;
  color: #b85248;
  background: rgba(184, 82, 72, 0.08);
  padding: 4px 6px;
  border-radius: 4px;
  word-break: break-word;
}

.ha-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ha-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.ha-row-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ha-entity-icon {
  color: var(--fg-mid, #4a463c);
  flex-shrink: 0;
}
.ha-label {
  flex: 1;
  font-size: 12px;
  color: var(--fg, #1c1a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ha-state {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 4px;
}
.ha-state.state-on {
  background: rgba(56, 161, 105, 0.14);
  color: #2f855a;
}
.ha-state.state-off {
  background: rgba(160, 174, 192, 0.18);
  color: var(--fg-soft, #7a7468);
}
.ha-state.state-err {
  background: rgba(184, 82, 72, 0.14);
  color: #b85248;
}
.ha-state.state-unknown {
  background: transparent;
  color: var(--fg-faint, #a8a294);
}
.ha-state.state-neutral {
  background: rgba(28, 26, 20, 0.05);
  color: var(--fg, #1c1a14);
}

.ha-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ha-action-btn {
  height: 24px;
  padding: 0 8px;
  font: inherit;
  font-size: 10.5px;
  border-radius: 5px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ha-action-btn.icon-only {
  width: 24px;
  padding: 0;
  justify-content: center;
}
.ha-action-btn:hover:not(:disabled) {
  background: var(--bg, #faf9f7);
  border-color: var(--fg-mid, #4a463c);
}
.ha-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.ha-spin { animation: ha-spin 0.9s linear infinite; }
@keyframes ha-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
