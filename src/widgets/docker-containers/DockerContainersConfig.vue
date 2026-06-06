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
})

const update = (patch: Partial<{ credentialId: string; serverLabel: string }>) => {
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

const dockerConnections = computed(() => credentialsStore.byCategory('docker'))

const goToCredentials = () => {
  router.push('/settings/credentials')
}

onMounted(() => {
  credentialsStore.loadCredentials()
})
</script>

<template>
  <div class="dkc-config">
    <label class="field">
      <span class="label">Conexión Docker</span>
      <select v-model="credentialId">
        <option value="" disabled>— Selecciona una conexión —</option>
        <option v-for="conn in dockerConnections" :key="conn.id" :value="conn.id">
          {{ conn.name }}
        </option>
      </select>
      <p v-if="dockerConnections.length === 0" class="hint warn">
        No tienes conexiones de gestión Docker.
        <button type="button" class="link" @click.stop.prevent="goToCredentials">
          Crear una
        </button>
      </p>
    </label>

    <label class="field">
      <span class="label">Etiqueta del servidor (opcional, override)</span>
      <input
        v-model="serverLabel"
        type="text"
        placeholder="Si se deja vacío, usa la de la conexión"
        autocomplete="off"
      />
    </label>

    <p class="hint">
      Lista todos los contenedores del servidor con su uso de CPU. Los datos y las acciones
      (arrancar / detener / reiniciar) pasan por el backend, que hace de proxy contra el servidor;
      el token nunca se expone al navegador. Se resaltan en ámbar los contenedores con CPU ≥ 70 %
      y en rojo los de CPU ≥ 90 %.
    </p>
  </div>
</template>

<style scoped>
.dkc-config {
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
