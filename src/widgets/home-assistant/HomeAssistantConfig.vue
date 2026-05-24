<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCredentialsStore } from '@/stores/credentials'
import IconPicker from '@/components/IconPicker.vue'

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
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const router = useRouter()
const credentialsStore = useCredentialsStore()

const cfg = computed<HaConfig>(() => props.modelValue as HaConfig)

const update = (patch: Partial<HaConfig>): void => {
  emit('update:modelValue', { ...cfg.value, ...patch })
}

const credentialId = computed({
  get: () => cfg.value.credentialId ?? '',
  set: (v: string) => update({ credentialId: v })
})

const title = computed({
  get: () => cfg.value.title ?? '',
  set: (v: string) => update({ title: v })
})

const pollIntervalSec = computed({
  get: () => cfg.value.pollIntervalSec ?? 10,
  set: (v: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return
    update({ pollIntervalSec: Math.max(5, Math.round(n)) })
  }
})

const entities = computed<HaEntity[]>(() => Array.isArray(cfg.value.entities) ? cfg.value.entities : [])

const haCredentials = computed(() => credentialsStore.byType('homeassistant'))

const goToCredentials = (): void => {
  router.push('/settings/credentials')
}

const setEntities = (next: HaEntity[]): void => {
  update({ entities: next })
}

const addEntity = (): void => {
  setEntities([...entities.value, { entityId: '', label: '', actions: [] }])
}

const removeEntity = (idx: number): void => {
  const next = entities.value.slice()
  next.splice(idx, 1)
  setEntities(next)
}

const moveEntity = (idx: number, dir: -1 | 1): void => {
  const next = entities.value.slice()
  const target = idx + dir
  if (target < 0 || target >= next.length) return
  const [item] = next.splice(idx, 1)
  next.splice(target, 0, item)
  setEntities(next)
}

const patchEntity = (idx: number, patch: Partial<HaEntity>): void => {
  const next = entities.value.slice()
  next[idx] = { ...next[idx], ...patch }
  setEntities(next)
}

const addAction = (entityIdx: number): void => {
  const actions = entities.value[entityIdx]?.actions ?? []
  patchEntity(entityIdx, {
    actions: [...actions, { label: '', domain: '', service: '', serviceData: undefined }]
  })
}

const removeAction = (entityIdx: number, actionIdx: number): void => {
  const actions = (entities.value[entityIdx]?.actions ?? []).slice()
  actions.splice(actionIdx, 1)
  patchEntity(entityIdx, { actions })
}

const patchAction = (entityIdx: number, actionIdx: number, patch: Partial<HaAction>): void => {
  const actions = (entities.value[entityIdx]?.actions ?? []).slice()
  actions[actionIdx] = { ...actions[actionIdx], ...patch }
  patchEntity(entityIdx, { actions })
}

const onServiceDataInput = (entityIdx: number, actionIdx: number, raw: string): void => {
  const trimmed = raw.trim()
  if (!trimmed) {
    patchAction(entityIdx, actionIdx, { serviceData: undefined })
    return
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      patchAction(entityIdx, actionIdx, { serviceData: parsed as Record<string, unknown> })
    }
  } catch {
    // JSON inválido: no aplicamos cambio, dejamos el textarea para que el usuario corrija
  }
}

const serviceDataString = (action: HaAction): string => {
  if (!action.serviceData) return ''
  try {
    return JSON.stringify(action.serviceData)
  } catch {
    return ''
  }
}

onMounted(() => {
  credentialsStore.loadCredentials()
})
</script>

<template>
  <div class="ha-config">
    <label class="field">
      <span class="label">Credencial Home Assistant</span>
      <select v-model="credentialId">
        <option value="" disabled>— Selecciona una credencial —</option>
        <option v-for="cred in haCredentials" :key="cred.id" :value="cred.id">
          {{ cred.name }}
        </option>
      </select>
      <p v-if="haCredentials.length === 0" class="hint warn">
        No tienes credenciales de tipo Home Assistant.
        <button type="button" class="link" @click.stop.prevent="goToCredentials">
          Crear una
        </button>
      </p>
    </label>

    <label class="field">
      <span class="label">Título (opcional)</span>
      <input v-model="title" type="text" placeholder="Salón" autocomplete="off" />
    </label>

    <label class="field">
      <span class="label">Refresco (segundos, mín. 5)</span>
      <input v-model.number="pollIntervalSec" type="number" min="5" step="1" />
    </label>

    <div class="entities">
      <div class="entities-head">
        <span class="label">Entidades</span>
        <button type="button" class="add" @click.stop.prevent="addEntity">+ Añadir entidad</button>
      </div>

      <p v-if="entities.length === 0" class="hint">
        Añade entidades por su <code>entity_id</code> (ej. <code>light.salon</code>).
      </p>

      <div v-for="(entity, eIdx) in entities" :key="eIdx" class="entity">
        <div class="entity-head">
          <input
            :value="entity.entityId ?? ''"
            type="text"
            placeholder="light.salon"
            class="entity-id"
            autocomplete="off"
            @input="patchEntity(eIdx, { entityId: ($event.target as HTMLInputElement).value })"
          />
          <input
            :value="entity.label ?? ''"
            type="text"
            placeholder="Etiqueta opcional"
            class="entity-label"
            autocomplete="off"
            @input="patchEntity(eIdx, { label: ($event.target as HTMLInputElement).value })"
          />
          <div class="entity-controls">
            <IconPicker
              :model-value="entity.icon ?? null"
              placeholder=""
              @update:model-value="(v) => patchEntity(eIdx, { icon: v })"
            />
            <button type="button" class="icon-btn" title="Subir" :disabled="eIdx === 0" @click.stop.prevent="moveEntity(eIdx, -1)">↑</button>
            <button type="button" class="icon-btn" title="Bajar" :disabled="eIdx === entities.length - 1" @click.stop.prevent="moveEntity(eIdx, 1)">↓</button>
            <button type="button" class="icon-btn danger" title="Eliminar entidad" @click.stop.prevent="removeEntity(eIdx)">×</button>
          </div>
        </div>

        <div class="actions-block">
          <div class="actions-head">
            <span class="sublabel">Acciones</span>
            <button type="button" class="add small" @click.stop.prevent="addAction(eIdx)">+ Añadir acción</button>
          </div>

          <div v-for="(action, aIdx) in entity.actions ?? []" :key="aIdx" class="action-row">
            <div class="action-line action-line-top">
              <input
                :value="action.label ?? ''"
                type="text"
                placeholder="Encender"
                class="action-label"
                autocomplete="off"
                @input="patchAction(eIdx, aIdx, { label: ($event.target as HTMLInputElement).value })"
              />
              <IconPicker
                :model-value="action.icon ?? null"
                placeholder=""
                @update:model-value="(v) => patchAction(eIdx, aIdx, { icon: v })"
              />
              <button type="button" class="icon-btn danger" title="Eliminar acción" @click.stop.prevent="removeAction(eIdx, aIdx)">×</button>
            </div>
            <div class="action-line action-line-bottom">
              <input
                :value="action.domain ?? ''"
                type="text"
                placeholder="light"
                class="action-domain"
                autocomplete="off"
                @input="patchAction(eIdx, aIdx, { domain: ($event.target as HTMLInputElement).value })"
              />
              <input
                :value="action.service ?? ''"
                type="text"
                placeholder="turn_on"
                class="action-service"
                autocomplete="off"
                @input="patchAction(eIdx, aIdx, { service: ($event.target as HTMLInputElement).value })"
              />
              <input
                :value="serviceDataString(action)"
                type="text"
                placeholder='{"brightness":255}'
                class="action-data"
                autocomplete="off"
                title="JSON opcional. Si no es válido, no se aplica."
                @input="onServiceDataInput(eIdx, aIdx, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="hint">
      El token vive en la credencial y nunca se expone al navegador: el backend hace de proxy
      contra <code>/api/states</code> y <code>/api/services</code> de Home Assistant.
    </p>
  </div>
</template>

<style scoped>
.ha-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.sublabel {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.field input,
.field select,
.entity input,
.action-row input {
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 12.5px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
  min-width: 0;
}
.field input:focus,
.field select:focus,
.entity input:focus,
.action-row input:focus { border-color: var(--fg-mid, #4a463c); }

.hint {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  line-height: 1.5;
  margin: 0;
}
.hint.warn { color: #b07a3a; }
.hint code {
  background: var(--bg-soft, #f3f1ec);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10.5px;
}
.link {
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--fg, #1c1a14);
  text-decoration: underline;
  cursor: pointer;
}
.link:hover { color: var(--fg-mid, #4a463c); }

.entities {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.entities-head,
.actions-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.add {
  background: transparent;
  border: 0.5px dashed var(--border, rgba(28, 26, 20, 0.3));
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
}
.add:hover { background: var(--bg-soft, #f3f1ec); }
.add.small { font-size: 10.5px; padding: 3px 8px; }

.entity {
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 7px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-soft, #f3f1ec);
}
.entity-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.entity-id {
  flex: 2 1 160px;
  min-width: 0;
}
.entity-label {
  flex: 1 1 120px;
  min-width: 0;
}
.entity-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.action-line {
  display: flex;
  gap: 6px;
  align-items: center;
}
.action-line-top .action-label {
  flex: 1 1 auto;
  min-width: 0;
}
.action-line-bottom .action-domain,
.action-line-bottom .action-service {
  flex: 1 1 0;
  min-width: 0;
}
.action-line-bottom .action-data {
  flex: 1.4 1 0;
  min-width: 0;
}

/* Compactar trigger del IconPicker dentro del config: solo icono + "+" */
.entity-controls :deep(.icon-picker .trigger),
.action-line :deep(.icon-picker .trigger) {
  height: 30px;
  padding: 0 8px;
  gap: 0;
  min-width: 30px;
}
.entity-controls :deep(.icon-picker .trigger-label),
.action-line :deep(.icon-picker .trigger-label) {
  display: none;
}
.actions-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 4px;
  border-left: 1.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.icon-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 0.5px solid transparent;
  background: transparent;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.icon-btn:hover:not(:disabled) {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  border-color: var(--border, rgba(28, 26, 20, 0.12));
}
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover:not(:disabled) {
  color: #b85248;
  border-color: rgba(184, 82, 72, 0.3);
}
</style>
