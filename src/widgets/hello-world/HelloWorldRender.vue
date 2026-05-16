<script setup lang="ts">
import type { Widget } from '@/types'

defineProps<{
  widget: Widget
}>()
</script>

<template>
  <div class="hw-render">
    <span class="hw-emoji">👋</span>
    <span class="hw-text">Hola, mundo</span>
  </div>
</template>

<style scoped>
.hw-render {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-mid, #4a463c);
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  padding: 4px 10px;
  border-radius: 6px;
}
.hw-emoji { font-size: 13px; line-height: 1; }
.hw-text { font-weight: 500; }
</style>
