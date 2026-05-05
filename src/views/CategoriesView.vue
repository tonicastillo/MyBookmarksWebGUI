<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useCategoriesStore, type CategoryNode } from '@/stores/categories'
import { useBookmarksStore } from '@/stores/bookmarks'
import CategoryTreeNode from '@/components/CategoryTreeNode.vue'
import type { CategoryReorderEntry } from '@/api/notion'

const router = useRouter()
const categoriesStore = useCategoriesStore()
const bookmarksStore = useBookmarksStore()

const localTree = ref<CategoryNode[]>([])
const isApplying = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const newName = ref('')

const cloneTree = (nodes: CategoryNode[]): CategoryNode[] =>
  JSON.parse(JSON.stringify(nodes))

const syncFromStore = () => {
  isApplying.value = true
  localTree.value = cloneTree(categoriesStore.tree)
  isApplying.value = false
}

watch(
  () => categoriesStore.tree,
  () => {
    if (!isApplying.value) syncFromStore()
  },
  { deep: true }
)

onMounted(async () => {
  await Promise.all([
    categoriesStore.loadCategories(),
    bookmarksStore.loadBookmarks()
  ])
  syncFromStore()
})

const isDescendant = (nodeId: string, candidateId: string, nodes: CategoryNode[]): boolean => {
  for (const n of nodes) {
    if (n.id === nodeId) return containsId(n.children, candidateId)
    if (isDescendant(nodeId, candidateId, n.children)) return true
  }
  return false
}

const containsId = (nodes: CategoryNode[], id: string): boolean => {
  for (const n of nodes) {
    if (n.id === id) return true
    if (containsId(n.children, id)) return true
  }
  return false
}

const buildEntries = (): CategoryReorderEntry[] => {
  const entries: CategoryReorderEntry[] = []
  const walk = (nodes: CategoryNode[], padreId: string | null) => {
    nodes.forEach((n, idx) => {
      const prev = categoriesStore.getById(n.id)
      const prevPadre = prev?.padreId ?? null
      if (!prev || prev.order !== idx || prevPadre !== padreId) {
        entries.push({ id: n.id, order: idx, padreId })
      }
      walk(n.children, n.id)
    })
  }
  walk(localTree.value, null)
  return entries
}

const onDragEnd = async () => {
  if (isSaving.value) return

  const entries = buildEntries()
  if (entries.length === 0) return

  for (const e of entries) {
    if (e.padreId && isDescendant(e.id, e.padreId, localTree.value)) {
      errorMessage.value = 'Movimiento inválido: una categoría no puede ser hija de su propio descendiente'
      syncFromStore()
      return
    }
  }

  isSaving.value = true
  errorMessage.value = null
  try {
    await categoriesStore.reorderTree(entries)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error reordenando'
    syncFromStore()
  } finally {
    isSaving.value = false
  }
}

const onRename = async (id: string, name: string) => {
  errorMessage.value = null
  try {
    await categoriesStore.update(id, { name })
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error renombrando'
  }
}

const onRecolor = async (id: string, color: string | null) => {
  errorMessage.value = null
  try {
    await categoriesStore.update(id, { color })
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error guardando color'
  }
}

const onDelete = async (id: string) => {
  const cat = categoriesStore.getById(id)
  const usedBy = bookmarksStore.bookmarks.filter(b => b.categoryId === id).length
  const message = usedBy > 0
    ? `"${cat?.name}" tiene ${usedBy} bookmarks asignados. Se quedarán sin categoría. ¿Continuar?`
    : `¿Borrar "${cat?.name}"?`
  if (!confirm(message)) return

  errorMessage.value = null
  try {
    await categoriesStore.remove(id)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error borrando'
  }
}

const onCreateRoot = async () => {
  const name = newName.value.trim()
  if (!name) return
  isSaving.value = true
  errorMessage.value = null
  try {
    const rootCount = localTree.value.length
    await categoriesStore.create({
      name,
      order: rootCount,
      padreId: null
    })
    newName.value = ''
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error creando'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="cats-view">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← Volver</button>
      <h1>Categorías</h1>
      <p class="hint">Arrastra para reordenar o cambiar de padre.</p>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div class="tree" :class="{ saving: isSaving }">
      <VueDraggable
        v-model="localTree"
        :animation="180"
        :disabled="isSaving"
        group="categories"
        handle=".drag-handle"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :empty-insert-threshold="20"
        @end="onDragEnd"
      >
        <CategoryTreeNode
          v-for="node in localTree"
          :key="node.id"
          :node="node"
          :busy="isSaving"
          @rename="onRename"
          @recolor="onRecolor"
          @delete="onDelete"
          @end="onDragEnd"
        />
      </VueDraggable>

      <div v-if="localTree.length === 0" class="empty">
        Aún no hay categorías. Crea la primera abajo.
      </div>
    </div>

    <div class="add-row">
      <input
        v-model="newName"
        type="text"
        placeholder="Nueva categoría raíz…"
        :disabled="isSaving"
        @keydown.enter="onCreateRoot"
      />
      <button
        class="btn btn-primary"
        :disabled="!newName.trim() || isSaving"
        @click="onCreateRoot"
      >
        Añadir
      </button>
    </div>
  </div>
</template>

<style scoped>
.cats-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}
.header { margin-bottom: 24px; }
.back-btn {
  font: inherit;
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 8px;
}
.back-btn:hover { color: var(--fg, #1c1a14); }
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--fg, #1c1a14);
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
}
.error {
  background: rgba(184, 82, 72, 0.08);
  color: #b85248;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.tree {
  position: relative;
  transition: opacity 0.15s;
}
.tree.saving {
  opacity: 0.6;
  pointer-events: none;
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--fg-faint, #a8a294);
  font-size: 13px;
  border: 0.5px dashed var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 8px;
}

.add-row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
}
.add-row input {
  flex: 1;
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.add-row input:focus { border-color: var(--fg-mid, #4a463c); }

.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border: 0;
}
.btn-primary:hover:not(:disabled) { background: var(--fg-mid, #4a463c); }
</style>
