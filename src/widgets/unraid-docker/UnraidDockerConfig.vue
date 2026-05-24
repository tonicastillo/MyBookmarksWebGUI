<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCredentialsStore } from '@/stores/credentials'

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const router = useRouter()
const credentialsStore = useCredentialsStore()

const cfg = computed(() => props.modelValue as {
  credentialId?: string
  serverLabel?: string
  containerName?: string
})

const update = (patch: Partial<{ credentialId: string; serverLabel: string; containerName: string }>) => {
  emit('update:modelValue', { ...cfg.value, ...patch })
}

const credentialId = computed({
  get: () => cfg.value.credentialId ?? '',
  set: (v: string) => update({ credentialId: v })
})
const serverLabel = computed({
  get: () => cfg.value.serverLabel ?? '',
  set: (v: string) => update({ serverLabel: v })
})
const containerName = computed({
  get: () => cfg.value.containerName ?? '',
  set: (v: string) => update({ containerName: v })
})

const unraidCredentials = computed(() => credentialsStore.byType('unraid'))

const goToCredentials = () => {
  router.push('/settings/credentials')
}

onMounted(() => {
  credentialsStore.loadCredentials()
})
</script>

<template>
  <div class="unr-config">
    <label class="field">
      <span class="label">Credencial Unraid</span>
      <select v-model="credentialId">
        <option value="" disabled>— Selecciona una credencial —</option>
        <option v-for="cred in unraidCredentials" :key="cred.id" :value="cred.id">
          {{ cred.name }}
        </option>
      </select>
      <p v-if="unraidCredentials.length === 0" class="hint warn">
        No tienes credenciales de tipo Unraid.
        <button type="button" class="link" @click.stop.prevent="goToCredentials">
          Crear una
        </button>
      </p>
    </label>

    <label class="field">
      <span class="label">Nombre del contenedor</span>
      <input
        v-model="containerName"
        type="text"
        placeholder="plex"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span class="label">Etiqueta del servidor (opcional, override)</span>
      <input
        v-model="serverLabel"
        type="text"
        placeholder="Si se deja vacío, usa la de la credencial"
        autocomplete="off"
      />
    </label>

    <p class="hint">
      El token se almacena en la credencial y nunca se expone al navegador al ejecutar
      acciones: el backend hace de proxy contra <code>/graphql</code> del servidor Unraid
      (requiere Unraid 6.12+ con el plugin Connect API).
    </p>
  </div>
</template>

<style scoped>
.unr-config {
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
.field input,
.field select {
  height: 32px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 7px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.field input:focus,
.field select:focus { border-color: var(--fg-mid, #4a463c); }
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
</style>
