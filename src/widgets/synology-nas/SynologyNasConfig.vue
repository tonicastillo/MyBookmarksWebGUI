<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCredentialsStore } from '@/stores/credentials'

interface SynologyConfig {
  credentialId?: string
  title?: string
  pollIntervalSec?: number
  diskWarnPercent?: number
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const router = useRouter()
const credentialsStore = useCredentialsStore()

const cfg = computed<SynologyConfig>(() => props.modelValue as SynologyConfig)

const update = (patch: Partial<SynologyConfig>): void => {
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

const diskWarnPercent = computed({
  get: () => cfg.value.diskWarnPercent ?? 85,
  set: (v: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return
    update({ diskWarnPercent: Math.min(100, Math.max(50, Math.round(n))) })
  }
})

const synoCredentials = computed(() => credentialsStore.byType('synology-nas'))

const goToCredentials = (): void => {
  router.push('/settings/credentials')
}

onMounted(() => {
  credentialsStore.loadCredentials()
})
</script>

<template>
  <div class="syno-config">
    <label class="field">
      <span class="label">Credencial Synology NAS</span>
      <select v-model="credentialId">
        <option value="" disabled>— Selecciona una credencial —</option>
        <option v-for="cred in synoCredentials" :key="cred.id" :value="cred.id">
          {{ cred.name }}
        </option>
      </select>
      <p v-if="synoCredentials.length === 0" class="hint warn">
        No tienes credenciales de tipo Synology NAS.
        <button type="button" class="link" @click.stop.prevent="goToCredentials">
          Crear una
        </button>
      </p>
    </label>

    <label class="field">
      <span class="label">Título (opcional)</span>
      <input v-model="title" type="text" placeholder="NAS de casa" autocomplete="off" />
    </label>

    <label class="field">
      <span class="label">Refresco (segundos, mín. 5)</span>
      <input v-model.number="pollIntervalSec" type="number" min="5" step="1" />
    </label>

    <label class="field">
      <span class="label">Aviso de disco lleno (% uso)</span>
      <input v-model.number="diskWarnPercent" type="number" min="50" max="100" step="1" />
      <p class="hint">Un volumen se resalta en rojo cuando su uso supera este porcentaje.</p>
    </label>

    <p class="hint">
      La contraseña vive en la credencial y nunca se expone al navegador: el backend hace de proxy
      contra la API DSM del NAS. El botón de reinicio requiere que la cuenta sea administrador.
    </p>
  </div>
</template>

<style scoped>
.syno-config {
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
