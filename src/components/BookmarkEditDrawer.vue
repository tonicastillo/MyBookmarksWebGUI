<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useEditDrawerStore } from '@/stores/editDrawer'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore } from '@/stores/categories'
import BookmarkForm from '@/components/BookmarkForm.vue'
import WidgetEditor from '@/components/widgets/WidgetEditor.vue'
import type { BookmarkInput } from '@/api/notion'
import {
  useBookmarkDuplicate,
  type BookmarkDuplicateData,
} from '@/composables/useBookmarkDuplicate'

const drawer = useEditDrawerStore()
const route = useRoute()
const bookmarksStore = useBookmarksStore()
const categoriesStore = useCategoriesStore()
const { consumePendingDuplicate } = useBookmarkDuplicate()

const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const currentBookmarkId = ref<string | undefined>(undefined)
const prefill = shallowRef<BookmarkDuplicateData | null>(null)

const bookmark = computed(() =>
  currentBookmarkId.value
    ? bookmarksStore.getById(currentBookmarkId.value)
    : undefined,
)

const headerTitle = computed(() =>
  currentBookmarkId.value ? 'Editar bookmark' : 'Nuevo bookmark',
)

watch(
  () => drawer.sessionKey,
  async () => {
    if (!drawer.isOpen) return
    errorMessage.value = null
    submitting.value = false
    currentBookmarkId.value = drawer.bookmarkId
    prefill.value = drawer.bookmarkId ? null : consumePendingDuplicate()
    await Promise.all([
      bookmarksStore.loadBookmarks(),
      categoriesStore.loadCategories(),
    ])
  },
  { immediate: true },
)

const lockScroll = () => {
  document.body.style.overflow = 'hidden'
}
const unlockScroll = () => {
  document.body.style.overflow = ''
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && drawer.isOpen) {
    event.preventDefault()
    drawer.close()
  }
}

watch(
  () => drawer.isOpen,
  (open) => {
    if (open) {
      lockScroll()
      window.addEventListener('keydown', handleEscape)
    } else {
      unlockScroll()
      window.removeEventListener('keydown', handleEscape)
    }
  },
)

watch(
  () => route.fullPath,
  () => {
    if (drawer.isOpen) drawer.close()
  },
)

onUnmounted(() => {
  unlockScroll()
  window.removeEventListener('keydown', handleEscape)
})

const handleSubmit = async (payload: {
  input: BookmarkInput
  imageFile: File | null
  removeImage: boolean
}) => {
  submitting.value = true
  errorMessage.value = null
  try {
    let savedId: string
    if (currentBookmarkId.value) {
      const updated = await bookmarksStore.update(
        currentBookmarkId.value,
        payload.input,
      )
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

    if (!currentBookmarkId.value) {
      currentBookmarkId.value = savedId
      prefill.value = null
      return
    }
    drawer.close()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error guardando'
  } finally {
    submitting.value = false
  }
}

const handleDelete = async () => {
  if (!currentBookmarkId.value) return
  if (!confirm(`¿Borrar "${bookmark.value?.name ?? 'este bookmark'}"?`)) return
  submitting.value = true
  try {
    await bookmarksStore.remove(currentBookmarkId.value)
    drawer.close()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error borrando'
    submitting.value = false
  }
}

const handleCancel = () => {
  drawer.close()
}

const handleBackdropClick = () => {
  drawer.close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="drawer.isOpen"
        class="drawer-root"
        role="dialog"
        aria-modal="true"
        :aria-label="headerTitle"
      >
        <div class="drawer-backdrop" @click="handleBackdropClick" />

        <aside class="drawer-panel" @click.stop>
          <header class="drawer-header">
            <h2>{{ headerTitle }}</h2>
            <button
              type="button"
              class="drawer-close"
              aria-label="Cerrar"
              @click="drawer.close()"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="drawer-body">
            <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

            <BookmarkForm
              :key="`form-${drawer.sessionKey}-${currentBookmarkId ?? 'new'}`"
              :bookmark="bookmark"
              :default-category-id="drawer.defaultCategoryId"
              :default-parent-bookmark-id="drawer.defaultParentBookmarkId"
              :prefill="prefill ?? undefined"
              :submitting="submitting"
              @submit="handleSubmit"
              @cancel="handleCancel"
              @delete="handleDelete"
            />

            <WidgetEditor
              v-if="bookmark"
              :bookmark-id="bookmark.id"
              :widgets="bookmark.widgets ?? []"
              class="widgets-section"
            />
            <div v-else class="widgets-placeholder">
              Guarda el bookmark primero para poder añadirle widgets.
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(28, 26, 20, 0.4);
}

.drawer-panel {
  position: relative;
  width: min(960px, 100%);
  height: 100%;
  background: var(--bg, #faf9f7);
  box-shadow: -8px 0 32px rgba(28, 26, 20, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 24px;
  border-bottom: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg, #faf9f7);
  flex-shrink: 0;
}
.drawer-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg, #1c1a14);
}
.drawer-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.drawer-close:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.error {
  background: rgba(184, 82, 72, 0.08);
  color: #b85248;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.widgets-section {
  margin-top: 24px;
}
.widgets-placeholder {
  margin-top: 24px;
  font-size: 12px;
  font-style: italic;
  color: var(--fg-faint, #a8a294);
  padding: 12px 14px;
  background: var(--bg-soft, #f3f1ec);
  border-radius: 10px;
  border: 0.5px dashed var(--border, rgba(28, 26, 20, 0.16));
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

@media (max-width: 720px) {
  .drawer-body {
    padding: 16px;
  }
  .drawer-header {
    padding: 14px 16px;
  }
}
</style>
