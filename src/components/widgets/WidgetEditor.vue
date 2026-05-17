<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Widget } from '@/types'
import { getWidgetType } from '@/widgets/registry'
import {
  createWidget,
  updateWidget,
  deleteWidget,
  reorderWidgets
} from '@/api/widgets'
import { useBookmarksStore } from '@/stores/bookmarks'
import WidgetTypePicker from './WidgetTypePicker.vue'

const props = defineProps<{
  bookmarkId: string
  widgets: Widget[]
}>()

const bookmarksStore = useBookmarksStore()

const localWidgets = ref<Widget[]>([...props.widgets])
const pickerOpen = ref(false)
const expandedId = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

watch(
  () => props.widgets,
  (next) => {
    localWidgets.value = [...next]
  }
)

const widgetTypeOf = (w: Widget) => getWidgetType(w.type)

const onAddType = async (type: string) => {
  pickerOpen.value = false
  busy.value = true
  error.value = null
  try {
    const def = getWidgetType(type)
    const updated = await createWidget({
      bookmarkId: props.bookmarkId,
      type,
      config: def ? { ...def.defaultConfig } : {}
    })
    bookmarksStore.upsertLocal(updated)
    const newest = updated.widgets?.[updated.widgets.length - 1]
    if (newest) expandedId.value = newest.id
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error añadiendo widget'
  } finally {
    busy.value = false
  }
}

const onDelete = async (widget: Widget) => {
  if (!confirm(`¿Eliminar el widget "${widgetTypeOf(widget)?.displayName ?? widget.type}"?`)) return
  busy.value = true
  error.value = null
  try {
    const updated = await deleteWidget(widget.id)
    bookmarksStore.upsertLocal(updated)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error eliminando widget'
  } finally {
    busy.value = false
  }
}

const onConfigUpdate = async (widget: Widget, config: Record<string, unknown>) => {
  busy.value = true
  error.value = null
  try {
    const updated = await updateWidget(widget.id, config)
    bookmarksStore.upsertLocal(updated)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error guardando widget'
  } finally {
    busy.value = false
  }
}

const onReorderEnd = async () => {
  const ids = localWidgets.value.map((w) => w.id)
  const originalOrder = props.widgets.map((w) => w.id).join(',')
  if (ids.join(',') === originalOrder) return
  busy.value = true
  error.value = null
  try {
    const updated = await reorderWidgets(props.bookmarkId, ids)
    bookmarksStore.upsertLocal(updated)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error reordenando widgets'
    localWidgets.value = [...props.widgets]
  } finally {
    busy.value = false
  }
}

const toggleExpanded = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const isExpanded = (id: string) => expandedId.value === id

const hasWidgets = computed(() => localWidgets.value.length > 0)
</script>

<template>
  <section class="we">
    <header class="we-head">
      <h3>Widgets</h3>
      <button
        type="button"
        class="we-add"
        :disabled="busy"
        @click="pickerOpen = true"
      >
        + Añadir widget
      </button>
    </header>

    <p v-if="!hasWidgets" class="we-empty">
      Este bookmark no tiene widgets aún. Añade uno para mostrar acciones o contenido extra en la card.
    </p>

    <p v-if="error" class="we-error">{{ error }}</p>

    <VueDraggable
      v-model="localWidgets"
      :animation="160"
      handle=".we-handle"
      ghost-class="we-ghost"
      @end="onReorderEnd"
      class="we-list"
    >
      <div v-for="w in localWidgets" :key="w.id" class="we-item">
        <header class="we-item-head">
          <button
            type="button"
            class="we-handle"
            title="Arrastrar para reordenar"
            aria-label="Reordenar"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="9" cy="6" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="18" r="1" />
              <circle cx="15" cy="6" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="18" r="1" />
            </svg>
          </button>
          <button
            type="button"
            class="we-toggle"
            @click="toggleExpanded(w.id)"
          >
            <span class="we-type">{{ widgetTypeOf(w)?.displayName ?? w.type }}</span>
            <svg
              :class="{ open: isExpanded(w.id) }"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            type="button"
            class="we-del"
            :disabled="busy"
            title="Eliminar widget"
            aria-label="Eliminar widget"
            @click="onDelete(w)"
          >
            ×
          </button>
        </header>
        <div v-if="isExpanded(w.id)" class="we-body">
          <component
            v-if="widgetTypeOf(w)"
            :is="widgetTypeOf(w)!.ConfigComponent"
            :model-value="w.config"
            @update:model-value="(c: Record<string, unknown>) => onConfigUpdate(w, c)"
          />
          <p v-else class="we-unknown">Tipo desconocido: {{ w.type }}</p>
        </div>
      </div>
    </VueDraggable>

    <WidgetTypePicker
      :open="pickerOpen"
      @select="onAddType"
      @close="pickerOpen = false"
    />
  </section>
</template>

<style scoped>
.we {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--bg-soft, #f3f1ec);
  border-radius: 12px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}

.we-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.we-head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.005em;
  color: var(--fg, #1c1a14);
}
.we-add {
  height: 28px;
  padding: 0 11px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
}
.we-add:hover:not(:disabled) {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
}
.we-add:disabled { opacity: 0.5; cursor: not-allowed; }

.we-empty {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  margin: 0;
  font-style: italic;
}
.we-error {
  font-size: 12px;
  color: #b85248;
  background: rgba(184, 82, 72, 0.08);
  padding: 6px 10px;
  border-radius: 6px;
  margin: 0;
}

.we-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 4px;
}
.we-item {
  background: var(--bg-elev, #ffffff);
  border-radius: 9px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  overflow: hidden;
}
.we-ghost {
  opacity: 0.4;
}
.we-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.we-handle {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--fg-faint, #a8a294);
  cursor: grab;
  border-radius: 5px;
}
.we-handle:hover { background: var(--bg-soft, #f3f1ec); color: var(--fg, #1c1a14); }
.we-handle:active { cursor: grabbing; }

.we-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fg, #1c1a14);
  cursor: pointer;
  padding: 4px 4px;
  text-align: left;
  border-radius: 5px;
}
.we-toggle:hover { background: var(--bg-soft, #f3f1ec); }
.we-toggle svg { transition: transform 160ms ease; color: var(--fg-faint, #a8a294); }
.we-toggle svg.open { transform: rotate(180deg); }
.we-type { line-height: 1.2; }

.we-del {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 0;
  background: transparent;
  color: var(--fg-faint, #a8a294);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.we-del:hover:not(:disabled) {
  background: rgba(184, 82, 72, 0.1);
  color: #b85248;
}
.we-del:disabled { opacity: 0.4; cursor: not-allowed; }

.we-body {
  padding: 8px 12px 12px;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.we-unknown {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  margin: 0;
}
</style>
