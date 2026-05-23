import { defineStore } from 'pinia'
import { ref } from 'vue'

interface OpenOptions {
  bookmarkId?: string
  defaultCategoryId?: string
  defaultParentBookmarkId?: string
}

export const useEditDrawerStore = defineStore('editDrawer', () => {
  const isOpen = ref(false)
  const bookmarkId = ref<string | undefined>(undefined)
  const defaultCategoryId = ref<string | undefined>(undefined)
  const defaultParentBookmarkId = ref<string | undefined>(undefined)
  const sessionKey = ref(0)

  const open = (opts: OpenOptions = {}) => {
    bookmarkId.value = opts.bookmarkId
    defaultCategoryId.value = opts.defaultCategoryId
    defaultParentBookmarkId.value = opts.defaultParentBookmarkId
    sessionKey.value += 1
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  return {
    isOpen,
    bookmarkId,
    defaultCategoryId,
    defaultParentBookmarkId,
    sessionKey,
    open,
    close,
  }
})
