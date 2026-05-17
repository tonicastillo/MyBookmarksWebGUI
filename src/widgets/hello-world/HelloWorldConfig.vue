<script setup lang="ts">
defineProps<{
  modelValue: Record<string, unknown>
}>()

defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()
</script>

<template>
  <div class="hw-config">
    <p>Este widget no necesita configuración. Solo muestra un saludo en la card del bookmark.</p>
  </div>
</template>

<style scoped>
.hw-config {
  font-size: 12px;
  color: var(--fg-soft, #7a7468);
  padding: 4px 0;
}
.hw-config p { margin: 0; }
</style>
