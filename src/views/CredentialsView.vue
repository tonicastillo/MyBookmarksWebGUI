<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useCredentialsStore } from '@/stores/credentials'
import { CREDENTIAL_TYPES, getCredentialType, type CredentialTypeDef } from '@/credentials/registry'
import type { Credential } from '@/types'

const store = useCredentialsStore()

const selectedType = ref<string>(CREDENTIAL_TYPES[0]?.type ?? '')
const newName = ref('')
const newData = reactive<Record<string, string>>({})

const creating = ref(false)
const createError = ref<string | null>(null)

const editingId = ref<string | null>(null)
const editName = ref('')
const editData = reactive<Record<string, string>>({})
const editBusy = ref(false)
const editError = ref<string | null>(null)

const deleteBusyId = ref<string | null>(null)
const inlineErrorById = ref<Record<string, string | null>>({})

const selectedTypeDef = computed<CredentialTypeDef | undefined>(() =>
  getCredentialType(selectedType.value)
)

const editingCredential = computed<Credential | undefined>(() =>
  editingId.value ? store.byId(editingId.value) : undefined
)
const editingTypeDef = computed<CredentialTypeDef | undefined>(() =>
  editingCredential.value ? getCredentialType(editingCredential.value.type) : undefined
)

const groupedByType = computed(() => {
  const map = new Map<string, Credential[]>()
  for (const c of store.credentials) {
    const list = map.get(c.type) ?? []
    list.push(c)
    map.set(c.type, list)
  }
  return Array.from(map.entries()).map(([type, list]) => ({
    type,
    typeDef: getCredentialType(type),
    list: [...list].sort((a, b) => a.name.localeCompare(b.name))
  }))
})

const resetCreateForm = () => {
  newName.value = ''
  for (const key of Object.keys(newData)) delete newData[key]
}

const onTypeChange = () => {
  resetCreateForm()
}

const buildDataPayload = (def: CredentialTypeDef, source: Record<string, string>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const field of def.fields) {
    const raw = source[field.key]?.trim() ?? ''
    if (raw) out[field.key] = raw
  }
  return out
}

const validateRequired = (def: CredentialTypeDef, source: Record<string, string>): string | null => {
  for (const field of def.fields) {
    if (field.required && !(source[field.key]?.trim())) {
      return `El campo "${field.label}" es obligatorio.`
    }
  }
  return null
}

const onCreate = async () => {
  const def = selectedTypeDef.value
  if (!def || creating.value) return
  createError.value = null
  const name = newName.value.trim()
  if (!name) {
    createError.value = 'El nombre es obligatorio.'
    return
  }
  const missing = validateRequired(def, newData)
  if (missing) {
    createError.value = missing
    return
  }
  creating.value = true
  try {
    await store.create({
      type: def.type,
      name,
      data: buildDataPayload(def, newData)
    })
    resetCreateForm()
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Error creando credencial'
  } finally {
    creating.value = false
  }
}

const startEdit = (cred: Credential) => {
  editingId.value = cred.id
  editName.value = cred.name
  editError.value = null
  for (const key of Object.keys(editData)) delete editData[key]
  const def = getCredentialType(cred.type)
  if (def) {
    for (const field of def.fields) {
      const raw = cred.data[field.key]
      editData[field.key] = typeof raw === 'string' ? raw : ''
    }
  }
}

const cancelEdit = () => {
  editingId.value = null
  editError.value = null
}

const onSaveEdit = async () => {
  const cred = editingCredential.value
  const def = editingTypeDef.value
  if (!cred || !def || editBusy.value) return
  editError.value = null
  const name = editName.value.trim()
  if (!name) {
    editError.value = 'El nombre es obligatorio.'
    return
  }
  const missing = validateRequired(def, editData)
  if (missing) {
    editError.value = missing
    return
  }
  editBusy.value = true
  try {
    await store.update(cred.id, {
      name,
      data: buildDataPayload(def, editData)
    })
    cancelEdit()
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Error actualizando credencial'
  } finally {
    editBusy.value = false
  }
}

const onDelete = async (cred: Credential) => {
  if (!confirm(`¿Borrar la credencial "${cred.name}"?`)) return
  deleteBusyId.value = cred.id
  inlineErrorById.value[cred.id] = null
  try {
    await store.remove(cred.id)
  } catch (e) {
    inlineErrorById.value[cred.id] = e instanceof Error ? e.message : 'Error borrando credencial'
  } finally {
    deleteBusyId.value = null
  }
}

onMounted(() => {
  store.loadCredentials()
})
</script>

<template>
  <div class="cred-view">
    <header class="head">
      <h1>Credenciales</h1>
      <p class="hint">
        Datos reutilizables (URL, token, etc.) que los widgets seleccionan en lugar de copiarlos cada vez.
        Cada usuario ve solo las suyas.
      </p>
    </header>

    <section class="card create">
      <h2>Nueva credencial</h2>
      <form class="create-form" @submit.prevent="onCreate">
        <label class="field">
          <span class="label">Tipo</span>
          <select v-model="selectedType" @change="onTypeChange">
            <option v-for="t in CREDENTIAL_TYPES" :key="t.type" :value="t.type">
              {{ t.displayName }}
            </option>
          </select>
          <p v-if="selectedTypeDef" class="field-hint">{{ selectedTypeDef.description }}</p>
        </label>

        <label class="field">
          <span class="label">Nombre</span>
          <input v-model="newName" type="text" maxlength="80" required placeholder="Ej. Fuji prod, NAS casa" />
        </label>

        <template v-if="selectedTypeDef">
          <label v-for="field in selectedTypeDef.fields" :key="field.key" class="field">
            <span class="label">
              {{ field.label }}<span v-if="field.required" class="req">*</span>
            </span>
            <input
              v-model="newData[field.key]"
              :type="field.type"
              :placeholder="field.placeholder"
              autocomplete="off"
            />
            <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
          </label>
        </template>

        <div class="form-actions">
          <button type="submit" class="primary" :disabled="creating">
            {{ creating ? 'Creando…' : 'Crear credencial' }}
          </button>
        </div>
        <div v-if="createError" class="error">{{ createError }}</div>
      </form>
    </section>

    <section class="card list">
      <h2>Tus credenciales</h2>
      <div v-if="store.loading" class="status">Cargando…</div>
      <div v-else-if="store.error" class="error">{{ store.error }}</div>
      <div v-else-if="store.credentials.length === 0" class="status">
        Aún no tienes ninguna credencial guardada.
      </div>

      <div v-else class="groups">
        <div v-for="group in groupedByType" :key="group.type" class="group">
          <h3 class="group-title">
            {{ group.typeDef?.displayName ?? group.type }}
            <span class="group-count">{{ group.list.length }}</span>
          </h3>
          <ul class="cred-list">
            <li v-for="cred in group.list" :key="cred.id" class="cred-row">
              <template v-if="editingId === cred.id && editingTypeDef">
                <div class="cred-edit">
                  <label class="field">
                    <span class="label">Nombre</span>
                    <input v-model="editName" type="text" maxlength="80" />
                  </label>
                  <label v-for="field in editingTypeDef.fields" :key="field.key" class="field">
                    <span class="label">
                      {{ field.label }}<span v-if="field.required" class="req">*</span>
                    </span>
                    <input
                      v-model="editData[field.key]"
                      :type="field.type"
                      :placeholder="field.placeholder"
                      autocomplete="off"
                    />
                    <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
                  </label>
                  <div v-if="editError" class="error">{{ editError }}</div>
                  <div class="form-actions row">
                    <button type="button" class="primary" :disabled="editBusy" @click="onSaveEdit">
                      {{ editBusy ? 'Guardando…' : 'Guardar' }}
                    </button>
                    <button type="button" :disabled="editBusy" @click="cancelEdit">Cancelar</button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="cred-head">
                  <span class="cred-name">{{ cred.name }}</span>
                </div>
                <div class="cred-actions">
                  <button type="button" @click="startEdit(cred)">Editar</button>
                  <button
                    type="button"
                    class="danger"
                    :disabled="deleteBusyId === cred.id"
                    @click="onDelete(cred)"
                  >
                    Borrar
                  </button>
                </div>
                <div v-if="inlineErrorById[cred.id]" class="error inline">
                  {{ inlineErrorById[cred.id] }}
                </div>
              </template>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cred-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}

.head h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.head .hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--fg-mid, #4a463c);
}

.card {
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 12px;
  padding: 16px 18px;
}
.card h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
}
.req { color: #b04444; margin-left: 2px; }
.field-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--fg-faint, #a8a294);
  line-height: 1.4;
}

input[type="text"],
input[type="password"],
input[type="url"],
select {
  font: inherit;
  font-size: 13.5px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.18));
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
  outline: none;
}
input:focus, select:focus {
  border-color: var(--fg, #1c1a14);
  background: var(--bg-elev, #ffffff);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.form-actions.row { justify-content: flex-start; }

button {
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.18));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  transition: background 120ms ease;
}
button:hover:not(:disabled) { background: var(--bg-soft, #f3f1ec); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.primary {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border-color: var(--fg, #1c1a14);
  font-weight: 500;
}
button.primary:hover:not(:disabled) { background: var(--fg-mid, #4a463c); }
button.danger { color: #b04444; border-color: rgba(176, 68, 68, 0.4); }
button.danger:hover:not(:disabled) { background: rgba(176, 68, 68, 0.08); }

.groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.group-title {
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}
.group-count {
  font-size: 11.5px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
}

.cred-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cred-row {
  padding: 12px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 10px;
  background: var(--bg, #faf9f7);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cred-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cred-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg, #1c1a14);
}
.cred-actions {
  display: flex;
  gap: 6px;
}

.cred-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status { font-size: 13px; color: var(--fg-mid, #4a463c); }
.error {
  font-size: 12.5px;
  color: #b04444;
  background: rgba(176, 68, 68, 0.08);
  padding: 8px 10px;
  border-radius: 6px;
}
.error.inline { margin-top: 4px; }
</style>
