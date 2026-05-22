<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RichTextEditor from './RichTextEditor.vue'

interface Note {
  id: string
  title: string
  body: string
}

const props = defineProps<{
  modelValue: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const parseNotes = (raw: unknown): Note[] => {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): Note[] => {
    if (!item || typeof item !== 'object') return []
    const n = item as Record<string, unknown>
    const title = typeof n.title === 'string' ? n.title : ''
    const body = typeof n.body === 'string' ? n.body : ''
    const id = typeof n.id === 'string' && n.id ? n.id : newId()
    return [{ id, title, body }]
  })
}

const notes = ref<Note[]>(parseNotes(props.modelValue.notes))

watch(
  () => props.modelValue,
  (next) => {
    const incoming = parseNotes(next.notes)
    if (JSON.stringify(incoming) !== JSON.stringify(notes.value)) {
      notes.value = incoming
    }
  }
)

const commit = (): void => {
  emit('update:modelValue', { ...props.modelValue, notes: notes.value })
}

const addNote = (): void => {
  notes.value.push({ id: newId(), title: '', body: '' })
  commit()
}

const removeNote = (index: number): void => {
  if (!confirm('¿Borrar esta nota?')) return
  notes.value.splice(index, 1)
  commit()
}

const moveUp = (index: number): void => {
  if (index <= 0) return
  const [item] = notes.value.splice(index, 1)
  notes.value.splice(index - 1, 0, item)
  commit()
}

const moveDown = (index: number): void => {
  if (index >= notes.value.length - 1) return
  const [item] = notes.value.splice(index, 1)
  notes.value.splice(index + 1, 0, item)
  commit()
}

const onTitleInput = (index: number, value: string): void => {
  notes.value[index].title = value
  commit()
}

const onBodyInput = (index: number, value: string): void => {
  notes.value[index].body = value
  commit()
}

const hasNotes = computed(() => notes.value.length > 0)
</script>

<template>
  <div class="notes-config">
    <p v-if="!hasNotes" class="empty">
      Aún no hay notas. Pulsa “Añadir nota” para crear la primera.
    </p>

    <ol v-else class="list">
      <li
        v-for="(note, index) in notes"
        :key="note.id"
        class="item"
      >
        <div class="item-head">
          <input
            type="text"
            class="title-input"
            placeholder="Título de la nota"
            :value="note.title"
            @input="onTitleInput(index, ($event.target as HTMLInputElement).value)"
          />
          <div class="item-actions">
            <button
              type="button"
              class="icon-btn"
              :disabled="index === 0"
              title="Subir"
              aria-label="Subir nota"
              @click="moveUp(index)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="index === notes.length - 1"
              title="Bajar"
              aria-label="Bajar nota"
              @click="moveDown(index)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn danger"
              title="Borrar"
              aria-label="Borrar nota"
              @click="removeNote(index)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
        <RichTextEditor
          :model-value="note.body"
          placeholder="Contenido de la nota…"
          @update:model-value="(v: string) => onBodyInput(index, v)"
        />
      </li>
    </ol>

    <button type="button" class="add-btn" @click="addNote">
      + Añadir nota
    </button>
  </div>
</template>

<style scoped>
.notes-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  margin: 0;
  padding: 12px 14px;
  font-size: 12.5px;
  color: var(--fg-faint, #a8a294);
  background: var(--bg-soft, #f3f1ec);
  border-radius: 8px;
  text-align: center;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.1));
  border-radius: 8px;
  background: var(--bg, #faf9f7);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.title-input:focus {
  border-color: var(--fg-mid, #4a463c);
}
.item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.icon-btn:hover:not(:disabled) {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.icon-btn.danger:hover:not(:disabled) {
  background: rgba(184, 82, 72, 0.1);
  color: #b85248;
}
.add-btn {
  align-self: flex-start;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  padding: 7px 12px;
  border: 0.5px dashed var(--border, rgba(28, 26, 20, 0.2));
  border-radius: 7px;
  background: transparent;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.add-btn:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
  border-color: var(--fg-faint, #a8a294);
}
</style>
