<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const cfg = computed(() => props.modelValue as { serverUrl?: string; serverLabel?: string; containerName?: string; apiToken?: string })

const update = (patch: Partial<{ serverUrl: string; serverLabel: string; containerName: string; apiToken: string }>) => {
  emit('update:modelValue', { ...cfg.value, ...patch })
}

const serverUrl = computed({
  get: () => cfg.value.serverUrl ?? '',
  set: (v: string) => update({ serverUrl: v })
})
const serverLabel = computed({
  get: () => cfg.value.serverLabel ?? '',
  set: (v: string) => update({ serverLabel: v })
})
const containerName = computed({
  get: () => cfg.value.containerName ?? '',
  set: (v: string) => update({ containerName: v })
})
const apiToken = computed({
  get: () => cfg.value.apiToken ?? '',
  set: (v: string) => update({ apiToken: v })
})
</script>

<template>
  <div class="unr-config">
    <label class="field">
      <span class="label">URL del servidor Unraid</span>
      <input
        v-model="serverUrl"
        type="url"
        placeholder="https://unraid.local"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span class="label">Nombre del servidor (display)</span>
      <input
        v-model="serverLabel"
        type="text"
        placeholder="Fuji"
        autocomplete="off"
      />
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
      <span class="label">API token (x-api-key)</span>
      <input
        v-model="apiToken"
        type="password"
        placeholder="••••••••"
        autocomplete="off"
      />
    </label>

    <p class="hint">
      El token se almacena en la base de datos local y nunca se expone al navegador
      al ejecutar acciones: el backend hace de proxy contra <code>/graphql</code> del
      servidor Unraid (requiere Unraid 6.12+ con el plugin Connect API).
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
.field input {
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
.field input:focus { border-color: var(--fg-mid, #4a463c); }
.hint {
  font-size: 11px;
  color: var(--fg-faint, #a8a294);
  line-height: 1.5;
  margin: 0;
}
.hint code {
  background: var(--bg-soft, #f3f1ec);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10.5px;
}
</style>
