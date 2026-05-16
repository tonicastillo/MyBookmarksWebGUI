<script setup lang="ts">
import { WIDGET_TYPES } from '@/widgets/registry'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  select: [type: string]
  close: []
}>()

const handleSelect = (type: string) => {
  emit('select', type)
}
</script>

<template>
  <div v-if="open" class="wtp-overlay" @click="emit('close')">
    <div class="wtp-modal" @click.stop>
      <header class="wtp-head">
        <h3>Añadir widget</h3>
        <button type="button" class="wtp-close" aria-label="Cerrar" @click="emit('close')">×</button>
      </header>
      <p class="wtp-intro">Selecciona el tipo de widget que quieres añadir al bookmark.</p>
      <ul class="wtp-list">
        <li v-for="t in WIDGET_TYPES" :key="t.type">
          <button type="button" class="wtp-item" @click="handleSelect(t.type)">
            <span class="wtp-name">{{ t.displayName }}</span>
            <span class="wtp-desc">{{ t.description }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wtp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 14, 0.45);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 16px;
}
.wtp-modal {
  background: var(--bg-elev, #ffffff);
  border-radius: 14px;
  width: 100%;
  max-width: 460px;
  max-height: 80vh;
  overflow: auto;
  padding: 20px;
  box-shadow: 0 16px 48px rgba(28, 26, 20, 0.2);
}
.wtp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.wtp-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.wtp-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 0;
  font-size: 20px;
  line-height: 1;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
}
.wtp-close:hover { background: var(--bg-soft, #f3f1ec); color: var(--fg, #1c1a14); }
.wtp-intro {
  font-size: 12.5px;
  color: var(--fg-soft, #7a7468);
  margin: 0 0 14px;
}
.wtp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wtp-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 9px;
  background: var(--bg, #faf9f7);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  cursor: pointer;
  font: inherit;
  transition: background 120ms ease, border-color 120ms ease;
}
.wtp-item:hover {
  background: var(--bg-soft, #f3f1ec);
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
}
.wtp-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg, #1c1a14);
}
.wtp-desc {
  font-size: 11.5px;
  color: var(--fg-soft, #7a7468);
  line-height: 1.4;
}
</style>
