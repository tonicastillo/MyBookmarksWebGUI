<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Widget } from '@/types'

interface Note {
  id: string
  title: string
  body: string
}

const props = defineProps<{
  widget: Widget
}>()

const notes = computed<Note[]>(() => {
  const raw = (props.widget.config as Record<string, unknown>)?.notes
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, idx): Note[] => {
    if (!item || typeof item !== 'object') return []
    const n = item as Record<string, unknown>
    const title = typeof n.title === 'string' ? n.title : ''
    const body = typeof n.body === 'string' ? n.body : ''
    const id = typeof n.id === 'string' && n.id ? n.id : `note-${idx}`
    return [{ id, title, body }]
  })
})

const openIndex = ref<number | null>(null)
const active = computed<Note | null>(() =>
  openIndex.value !== null ? notes.value[openIndex.value] ?? null : null
)

const openNote = (index: number): void => {
  openIndex.value = index
}

const closeNote = (): void => {
  openIndex.value = null
}

const onKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' && openIndex.value !== null) {
    closeNote()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="notes.length > 0" class="notes-render">
    <div class="notes-head">
      <svg class="notes-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
      <span class="notes-label">Notas</span>
    </div>
    <ul class="notes-list">
      <li v-for="(note, index) in notes" :key="note.id">
        <button
          type="button"
          class="note-item"
          @click="openNote(index)"
        >
          {{ note.title || 'Sin título' }}
        </button>
      </li>
    </ul>
  </div>

  <Teleport to="body">
    <div
      v-if="active"
      class="note-overlay"
      @click="closeNote"
    >
      <div class="note-modal" @click.stop>
        <header class="note-head">
          <h3>{{ active.title || 'Sin título' }}</h3>
          <button
            type="button"
            class="note-close"
            aria-label="Cerrar"
            @click="closeNote"
          >×</button>
        </header>
        <div v-if="active.body" class="note-body" v-html="active.body"></div>
        <p v-else class="note-empty">Esta nota no tiene contenido.</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.notes-render {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.notes-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.notes-icon {
  flex-shrink: 0;
}
.notes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.note-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  font: inherit;
  font-size: 12.5px;
  color: var(--fg-mid, #4a463c);
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-item:hover {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
}

.note-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 14, 0.45);
  display: grid;
  place-items: center;
  z-index: 1000;
  padding: 16px;
}
.note-modal {
  background: var(--bg-elev, #ffffff);
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(28, 26, 20, 0.2);
}
.note-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 10px;
  border-bottom: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.note-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg, #1c1a14);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 0;
  font-size: 20px;
  line-height: 1;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  flex-shrink: 0;
}
.note-close:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.note-body {
  padding: 16px 20px 20px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.55;
  color: var(--fg, #1c1a14);
}
.note-empty {
  margin: 0;
  padding: 16px 20px 20px;
  font-size: 13px;
  color: var(--fg-faint, #a8a294);
  font-style: italic;
}
</style>

<style>
.note-body p {
  margin: 0 0 10px;
}
.note-body p:last-child {
  margin-bottom: 0;
}
.note-body ul,
.note-body ol {
  margin: 0 0 10px;
  padding-left: 24px;
}
.note-body li {
  margin: 3px 0;
}
.note-body a {
  color: oklch(0.55 0.18 260);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.note-body strong {
  font-weight: 700;
}
.note-body em {
  font-style: italic;
}
</style>
