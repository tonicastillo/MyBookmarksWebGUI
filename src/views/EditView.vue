<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore } from '@/stores/categories'
import BookmarkForm from '@/components/BookmarkForm.vue'
import type { BookmarkInput } from '@/api/notion'

const route = useRoute()
const router = useRouter()
const bookmarksStore = useBookmarksStore()
const categoriesStore = useCategoriesStore()

const id = computed(() => (route.params.id as string | undefined) || undefined)
const bookmark = computed(() => (id.value ? bookmarksStore.getById(id.value) : undefined))

const defaultCategoryId = computed(() => {
  if (id.value) return undefined
  const q = route.query.categoryId
  return typeof q === 'string' && q ? q : undefined
})
const defaultParentBookmarkId = computed(() => {
  if (id.value) return undefined
  const q = route.query.parentBookmarkId
  return typeof q === 'string' && q ? q : undefined
})

const submitting = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([
    bookmarksStore.loadBookmarks(),
    categoriesStore.loadCategories()
  ])
})

const handleSubmit = async (payload: { input: BookmarkInput; imageFile: File | null; removeImage: boolean }) => {
  submitting.value = true
  errorMessage.value = null
  try {
    let savedId: string
    if (id.value) {
      const updated = await bookmarksStore.update(id.value, payload.input)
      savedId = updated.id
    } else {
      const created = await bookmarksStore.create(payload.input)
      savedId = created.id
    }

    if (payload.imageFile) {
      await bookmarksStore.uploadImage(savedId, payload.imageFile)
    } else if (payload.removeImage && bookmark.value?.imageUrl) {
      await bookmarksStore.removeImage(savedId)
    }

    router.push('/')
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error guardando'
  } finally {
    submitting.value = false
  }
}

const handleDelete = async () => {
  if (!id.value) return
  if (!confirm(`¿Borrar "${bookmark.value?.name ?? 'este bookmark'}"?`)) return
  submitting.value = true
  try {
    await bookmarksStore.remove(id.value)
    router.push('/')
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error borrando'
    submitting.value = false
  }
}

const handleCancel = () => {
  router.back()
}
</script>

<template>
  <div class="edit-view">
    <header class="header">
      <button class="back-btn" @click="router.back()">← Volver</button>
      <h1>{{ id ? 'Editar bookmark' : 'Nuevo bookmark' }}</h1>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <BookmarkForm
      :bookmark="bookmark"
      :default-category-id="defaultCategoryId"
      :default-parent-bookmark-id="defaultParentBookmarkId"
      :submitting="submitting"
      @submit="handleSubmit"
      @cancel="handleCancel"
      @delete="handleDelete"
    />
  </div>
</template>

<style scoped>
.edit-view {
  max-width: 880px;
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
.back-btn:hover {
  color: var(--fg, #1c1a14);
}
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
</style>
