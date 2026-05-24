<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { searchIcons, type IconHit } from '@/lib/icons'
import Icon from './Icon.vue'

interface Props {
  modelValue: string | null | undefined
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: 'Elegir icono'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const open = ref(false)
const wrapper = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<IconHit[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const RESULT_LIMIT = 240

const currentLocalName = computed(() => {
  if (!props.modelValue) return ''
  const idx = props.modelValue.indexOf(':')
  return idx >= 0 ? props.modelValue.slice(idx + 1) : props.modelValue
})

let runId = 0

const runSearch = async (q: string): Promise<void> => {
  const myRun = ++runId
  loading.value = true
  loadError.value = null
  try {
    const hits = await searchIcons(q, RESULT_LIMIT)
    if (myRun !== runId) return
    results.value = hits
  } catch (err) {
    if (myRun !== runId) return
    loadError.value = err instanceof Error ? err.message : 'No se pudo cargar la librería de iconos'
    results.value = []
  } finally {
    if (myRun === runId) loading.value = false
  }
}

const toggle = async (): Promise<void> => {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    await nextTick()
    searchInput.value?.focus()
    if (results.value.length === 0) {
      await runSearch(query.value)
    }
  }
}

const close = (): void => { open.value = false }

const select = (name: string | null): void => {
  emit('update:modelValue', name)
  close()
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(query, (next) => {
  if (!open.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    runSearch(next)
  }, 120)
})

const onDocumentClick = (event: MouseEvent): void => {
  if (!open.value) return
  if (wrapper.value && !wrapper.value.contains(event.target as Node)) close()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && open.value) close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  if (debounceTimer) clearTimeout(debounceTimer)
})

const isSelected = (name: string): boolean => props.modelValue === name
</script>

<template>
  <div ref="wrapper" class="icon-picker">
    <button
      type="button"
      class="trigger"
      :class="{ empty: !modelValue }"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-label="modelValue ? `Icono ${currentLocalName}` : placeholder"
      @click.stop="toggle"
    >
      <Icon v-if="modelValue" :name="modelValue" :size="16" />
      <span v-else class="empty-mark" aria-hidden="true">＋</span>
      <span class="trigger-label">{{ modelValue ? currentLocalName : placeholder }}</span>
    </button>

    <div v-if="open" class="popover" role="dialog" @click.stop>
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        class="search"
        placeholder="Buscar (ej. home, user, star)"
        autocomplete="off"
        spellcheck="false"
      />

      <div v-if="loading && results.length === 0" class="status">Cargando…</div>
      <div v-else-if="loadError" class="status error">{{ loadError }}</div>
      <div v-else-if="results.length === 0" class="status">Sin resultados</div>

      <div v-else class="grid" role="listbox">
        <button
          v-for="hit in results"
          :key="hit.name"
          type="button"
          class="cell"
          :class="{ selected: isSelected(hit.name) }"
          :title="hit.name"
          role="option"
          :aria-selected="isSelected(hit.name)"
          @click.stop="select(hit.name)"
        >
          <Icon :name="hit.name" :size="18" />
        </button>
      </div>

      <div class="footer">
        <span class="hint">{{ results.length === RESULT_LIMIT ? `Mostrando ${RESULT_LIMIT} (afina la búsqueda)` : `${results.length} resultados` }}</span>
        <button
          v-if="modelValue"
          type="button"
          class="clear"
          @click.stop="select(null)"
        >
          Quitar icono
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.icon-picker {
  position: relative;
  display: inline-block;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 12.5px;
  color: var(--fg, #1c1a14);
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
  max-width: 220px;
}
.trigger:hover:not(:disabled) {
  border-color: var(--fg-mid, #4a463c);
}
.trigger:disabled { cursor: not-allowed; opacity: 0.5; }
.trigger.empty { color: var(--fg-faint, #a8a294); }
.empty-mark {
  font-size: 14px;
  line-height: 1;
  color: var(--fg-faint, #a8a294);
}
.trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: 320px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search {
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 12.5px;
  background: var(--bg, #faf9f7);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.search:focus { border-color: var(--fg-mid, #4a463c); }

.status {
  font-size: 11.5px;
  color: var(--fg-faint, #a8a294);
  padding: 8px 4px;
  text-align: center;
}
.status.error { color: #b85248; }

.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  max-height: 260px;
  overflow-y: auto;
  padding: 2px;
}
.cell {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 0.5px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--fg, #1c1a14);
  cursor: pointer;
  transition: background 80ms ease, border-color 80ms ease;
}
.cell:hover {
  background: var(--bg-soft, #f3f1ec);
  border-color: var(--border, rgba(28, 26, 20, 0.16));
}
.cell.selected {
  background: var(--bg-soft, #f3f1ec);
  border-color: var(--fg, #1c1a14);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.hint {
  font-size: 10.5px;
  color: var(--fg-faint, #a8a294);
}
.clear {
  font: inherit;
  font-size: 11px;
  padding: 4px 8px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 5px;
  background: transparent;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
}
.clear:hover {
  color: #b85248;
  border-color: rgba(184, 82, 72, 0.3);
}
</style>
