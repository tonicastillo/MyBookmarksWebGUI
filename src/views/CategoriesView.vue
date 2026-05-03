<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCategoriesStore } from '@/stores/categories'
import { useBookmarksStore } from '@/stores/bookmarks'
import type { Category } from '@/types'

const router = useRouter()
const categoriesStore = useCategoriesStore()
const bookmarksStore = useBookmarksStore()

interface RowDraft {
  name: string
  order: number
  padreId: string
  level: number | ''
}

const drafts = reactive<Record<string, RowDraft>>({})
const dirty = ref<Set<string>>(new Set())
const saving = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const newCategory = reactive<RowDraft>({
  name: '',
  order: 0,
  padreId: '',
  level: ''
})

const initDrafts = (categories: Category[]) => {
  for (const c of categories) {
    drafts[c.id] = {
      name: c.name,
      order: c.order,
      padreId: c.padreId ?? '',
      level: c.level ?? ''
    }
  }
}

onMounted(async () => {
  await Promise.all([
    categoriesStore.loadCategories(),
    bookmarksStore.loadBookmarks()
  ])
  initDrafts(categoriesStore.orderedCategories)
})

const markDirty = (id: string) => {
  dirty.value.add(id)
}

const handleSave = async (id: string) => {
  const draft = drafts[id]
  if (!draft) return
  saving.value = id
  errorMessage.value = null
  try {
    await categoriesStore.update(id, {
      name: draft.name.trim(),
      order: Number(draft.order),
      padreId: draft.padreId || null,
      level: draft.level === '' ? null : Number(draft.level)
    })
    dirty.value.delete(id)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error guardando'
  } finally {
    saving.value = null
  }
}

const handleDelete = async (id: string) => {
  const cat = categoriesStore.getById(id)
  const usedBy = bookmarksStore.bookmarks.filter(b => b.categoryId === id).length
  const message = usedBy > 0
    ? `"${cat?.name}" tiene ${usedBy} bookmarks asignados. Se quedarán sin categoría. ¿Continuar?`
    : `¿Borrar "${cat?.name}"?`
  if (!confirm(message)) return
  errorMessage.value = null
  try {
    await categoriesStore.remove(id)
    delete drafts[id]
    dirty.value.delete(id)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error borrando'
  }
}

const handleCreate = async () => {
  if (!newCategory.name.trim()) return
  saving.value = 'new'
  errorMessage.value = null
  try {
    const created = await categoriesStore.create({
      name: newCategory.name.trim(),
      order: Number(newCategory.order),
      padreId: newCategory.padreId || null,
      level: newCategory.level === '' ? null : Number(newCategory.level)
    })
    drafts[created.id] = {
      name: created.name,
      order: created.order,
      padreId: created.padreId ?? '',
      level: created.level ?? ''
    }
    newCategory.name = ''
    newCategory.order = 0
    newCategory.padreId = ''
    newCategory.level = ''
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error creando'
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="cats-view">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← Volver</button>
      <h1>Categorías</h1>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div class="table">
      <div class="row head">
        <div>Nombre</div>
        <div>Orden</div>
        <div>Padre</div>
        <div>Nivel</div>
        <div></div>
      </div>

      <div
        v-for="c in categoriesStore.orderedCategories"
        :key="c.id"
        class="row"
        :class="{ dirty: dirty.has(c.id) }"
      >
        <input
          v-model="drafts[c.id].name"
          type="text"
          @input="markDirty(c.id)"
        />
        <input
          v-model.number="drafts[c.id].order"
          type="number"
          @input="markDirty(c.id)"
        />
        <select v-model="drafts[c.id].padreId" @change="markDirty(c.id)">
          <option value="">— Sin padre —</option>
          <option
            v-for="p in categoriesStore.orderedCategories"
            :key="p.id"
            :value="p.id"
            :disabled="p.id === c.id"
          >
            {{ p.name }}
          </option>
        </select>
        <input
          v-model="drafts[c.id].level"
          type="number"
          placeholder="—"
          @input="markDirty(c.id)"
        />
        <div class="actions">
          <button
            class="btn btn-primary"
            :disabled="!dirty.has(c.id) || saving === c.id"
            @click="handleSave(c.id)"
          >
            {{ saving === c.id ? '…' : 'Guardar' }}
          </button>
          <button class="btn btn-danger" @click="handleDelete(c.id)">Borrar</button>
        </div>
      </div>

      <div class="row new">
        <input v-model="newCategory.name" type="text" placeholder="Nueva categoría…" />
        <input v-model.number="newCategory.order" type="number" placeholder="0" />
        <select v-model="newCategory.padreId">
          <option value="">— Sin padre —</option>
          <option v-for="p in categoriesStore.orderedCategories" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <input v-model="newCategory.level" type="number" placeholder="—" />
        <div class="actions">
          <button
            class="btn btn-primary"
            :disabled="!newCategory.name.trim() || saving === 'new'"
            @click="handleCreate"
          >
            {{ saving === 'new' ? '…' : 'Añadir' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cats-view {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}
.header {
  margin-bottom: 28px;
}
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
.error {
  background: rgba(184, 82, 72, 0.08);
  color: #b85248;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.table {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.row {
  display: grid;
  grid-template-columns: 2fr 90px 2fr 80px auto;
  gap: 8px;
  padding: 8px 0;
  align-items: center;
  border-bottom: 0.5px solid var(--border, rgba(28, 26, 20, 0.06));
}
.row.head {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
  padding: 4px 0;
}
.row.dirty input,
.row.dirty select {
  border-color: var(--fg-mid, #4a463c);
}
.row.new {
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  margin-top: 8px;
  padding-top: 12px;
}

.row input,
.row select {
  height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  color: var(--fg, #1c1a14);
  outline: none;
}
.row input:focus,
.row select:focus {
  border-color: var(--fg-mid, #4a463c);
}

.actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
.btn {
  height: 28px;
  padding: 0 10px;
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
.btn-danger {
  background: transparent;
  color: #b85248;
  border: 0.5px solid rgba(184, 82, 72, 0.3);
}
.btn-danger:hover { background: rgba(184, 82, 72, 0.08); }
</style>
