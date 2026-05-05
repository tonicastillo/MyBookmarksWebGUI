<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { CategoryNode } from '@/stores/categories'
import CategoryColorPicker from '@/components/CategoryColorPicker.vue'

interface Props {
  node: CategoryNode
  busy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'rename', id: string, name: string): void
  (e: 'recolor', id: string, color: string | null): void
  (e: 'delete', id: string): void
  (e: 'end'): void
}>()

const localName = ref(props.node.name)

watch(
  () => props.node.name,
  (name) => {
    if (name !== localName.value) localName.value = name
  }
)

const onNameBlur = () => {
  const trimmed = localName.value.trim()
  if (!trimmed) {
    localName.value = props.node.name
    return
  }
  if (trimmed !== props.node.name) emit('rename', props.node.id, trimmed)
}

const onColorChange = (value: string | null) => {
  const current = props.node.color ?? null
  if (value !== current) emit('recolor', props.node.id, value)
}
</script>

<template>
  <div class="node-wrapper">
    <div class="node">
      <span class="drag-handle" aria-label="Mover">⋮⋮</span>
      <input
        v-model="localName"
        type="text"
        class="name"
        :disabled="busy"
        @blur="onNameBlur"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <CategoryColorPicker
        :model-value="node.color ?? null"
        :disabled="busy"
        @update:model-value="onColorChange"
      />
      <button class="btn-delete" :disabled="busy" @click="emit('delete', node.id)">
        Borrar
      </button>
    </div>

    <div class="children">
      <VueDraggable
        v-model="node.children"
        :animation="180"
        :disabled="busy"
        group="categories"
        handle=".drag-handle"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :empty-insert-threshold="20"
        @end="emit('end')"
      >
        <CategoryTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :busy="busy"
          @rename="(id, name) => emit('rename', id, name)"
          @recolor="(id, color) => emit('recolor', id, color)"
          @delete="(id) => emit('delete', id)"
          @end="emit('end')"
        />
      </VueDraggable>
    </div>
  </div>
</template>

<style scoped>
.node-wrapper {
  display: flex;
  flex-direction: column;
}
.node {
  display: grid;
  grid-template-columns: 18px 1fr 36px auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 0.5px solid var(--border, rgba(28, 26, 20, 0.06));
  background: var(--bg-elev, #ffffff);
  border-radius: 6px;
  margin-bottom: 2px;
}
.drag-handle {
  cursor: grab;
  user-select: none;
  color: var(--fg-faint, #a8a294);
  text-align: center;
  font-size: 14px;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.drag-handle:hover { opacity: 1; }
.drag-handle:active { cursor: grabbing; }

.name {
  height: 28px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  background: transparent;
  border: 0.5px solid transparent;
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.name:hover:not(:disabled) {
  border-color: var(--border, rgba(28, 26, 20, 0.12));
}
.name:focus {
  border-color: var(--fg-mid, #4a463c);
  background: var(--bg-elev, #ffffff);
}

.color {
  width: 32px;
  height: 26px;
  padding: 0;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.color:disabled { cursor: not-allowed; opacity: 0.4; }

.btn-delete {
  height: 26px;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  background: transparent;
  color: #b85248;
  border: 0.5px solid rgba(184, 82, 72, 0.3);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-delete:hover:not(:disabled) { background: rgba(184, 82, 72, 0.08); }
.btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

.children {
  margin-left: 22px;
  border-left: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  padding-left: 8px;
  min-height: 6px;
}

:deep(.drag-ghost) {
  opacity: 0.4;
  background: var(--bg-elev, #ffffff);
}
:deep(.drag-chosen) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
</style>
