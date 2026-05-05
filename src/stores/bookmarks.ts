import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Bookmark } from '@/types'
import {
  fetchBookmarks,
  createBookmark as apiCreateBookmark,
  updateBookmark as apiUpdateBookmark,
  deleteBookmark as apiDeleteBookmark,
  uploadBookmarkImage as apiUploadImage,
  deleteBookmarkImage as apiDeleteImage,
  type BookmarkInput
} from '@/api/notion'
import { useCache } from '@/composables/useCache'
import { groupBookmarksByParent, type BookmarkGroup } from '@/composables/useBookmarkGroups'

const CACHE_KEY = 'bookmarks'

export const useBookmarksStore = defineStore('bookmarks', () => {
  const bookmarks = ref<Bookmark[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const { saveToCache, getFromCache, isCacheValid, clearCache } = useCache()

  const tagCounts = computed(() => {
    const counts = new Map<string, number>()
    bookmarks.value.forEach(b => b.tags.forEach(t => {
      counts.set(t, (counts.get(t) || 0) + 1)
    }))
    return counts
  })

  const stripEmoji = (str: string): string => {
    return str.replace(/^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\s]+/u, '')
  }

  const allTags = computed(() => {
    return Array.from(tagCounts.value.keys()).sort((a, b) =>
      stripEmoji(a).toLowerCase().localeCompare(stripEmoji(b).toLowerCase())
    )
  })

  const getAvailableTags = (selectedTags: string[]): Set<string> => {
    if (selectedTags.length === 0) {
      return new Set(allTags.value)
    }

    const matchingBookmarks = bookmarks.value.filter(b =>
      selectedTags.every(tag => b.tags.includes(tag))
    )

    const available = new Set<string>()
    matchingBookmarks.forEach(b => b.tags.forEach(t => available.add(t)))
    return available
  }

  const visibleBookmarks = computed(() => {
    return bookmarks.value.filter(b => b.visibleAtStart)
  })

  const refreshing = ref(false)

  const loadBookmarks = async (forceRefresh = false): Promise<void> => {
    // Siempre intentar cargar desde caché primero (incluso expirada)
    const cached = getFromCache<Bookmark[]>(CACHE_KEY)
    const hasCachedData = cached && cached.length > 0

    if (hasCachedData) {
      bookmarks.value = cached
      // Si la caché es válida y no forzamos, no hacemos fetch
      if (!forceRefresh && isCacheValid(CACHE_KEY)) {
        return
      }
    }

    // Si no hay datos cacheados, mostramos loading completo
    // Si hay datos cacheados, solo mostramos refreshing (sutil)
    if (!hasCachedData) {
      loading.value = true
    } else {
      refreshing.value = true
    }
    error.value = null

    try {
      const data = await fetchBookmarks()
      bookmarks.value = data
      saveToCache(CACHE_KEY, data)
    } catch (e) {
      // Solo mostramos error si no teníamos datos cacheados
      if (!hasCachedData) {
        error.value = e instanceof Error ? e.message : 'Error loading bookmarks'
      }
      console.error('Error loading bookmarks:', e)
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  const getByCategory = (categoryId: string): Bookmark[] => {
    return bookmarks.value.filter(b => b.categoryId === categoryId)
  }

  const getVisibleByCategory = (categoryId: string): Bookmark[] => {
    return bookmarks.value.filter(b => b.categoryId === categoryId && b.visibleAtStart)
  }

  /**
   * Devuelve los grupos (mega cards + sueltos) visibles al inicio para una categoría.
   * - El "lead" del grupo es el bookmark visible (padre o suelto).
   * - Los hijos se añaden desde el set completo de bookmarks, ignorando su propio
   *   `visibleAtStart` (un padre visible muestra siempre toda su familia).
   */
  const getVisibleGroupsByCategory = (categoryId: string): BookmarkGroup[] => {
    const allGroups = groupBookmarksByParent(bookmarks.value)
    return allGroups
      .filter(g => g.bookmark.categoryId === categoryId && g.bookmark.visibleAtStart)
  }

  /**
   * Aplica búsqueda y filtros por tags devolviendo grupos.
   * Un grupo coincide si el padre o cualquier hijo coincide con la query/tags.
   * Los hijos del grupo se mantienen completos (no se podan por la consulta).
   *
   * Si se proporciona `categoryIds`, el grupo debe pertenecer a una de esas
   * categorías (mira `categoryId` del lead). Los bookmarks sin categoría
   * quedan excluidos cuando hay filtro de categoría activo.
   * `visibleAtStart` se ignora en este modo: incluye también los ocultos.
   */
  const searchAndFilterGroups = (query: string, tags: string[], categoryIds?: string[]): BookmarkGroup[] => {
    const q = query.toLowerCase().trim()
    const allGroups = groupBookmarksByParent(bookmarks.value)
    const categorySet = categoryIds && categoryIds.length > 0 ? new Set(categoryIds) : null

    const matchesQuery = (b: Bookmark): boolean => {
      if (!q) return true
      const nameMatch = b.name.toLowerCase().includes(q)
      const subtitleMatch = !!b.subtitle?.toLowerCase().includes(q)
      const tagsMatch = b.tags.some(t => t.toLowerCase().includes(q))
      return nameMatch || subtitleMatch || tagsMatch
    }

    const matchesTags = (b: Bookmark): boolean => {
      if (tags.length === 0) return true
      return tags.every(tag => b.tags.includes(tag))
    }

    const matchesCategory = (g: BookmarkGroup): boolean => {
      if (!categorySet) return true
      return !!g.bookmark.categoryId && categorySet.has(g.bookmark.categoryId)
    }

    return allGroups.filter(g => {
      if (!matchesCategory(g)) return false
      const all = [g.bookmark, ...g.children]
      return all.some(b => matchesQuery(b) && matchesTags(b))
    })
  }

  const search = (query: string): Bookmark[] => {
    const q = query.toLowerCase().trim()
    if (!q) return []

    return bookmarks.value.filter(b => {
      const nameMatch = b.name.toLowerCase().includes(q)
      const subtitleMatch = b.subtitle?.toLowerCase().includes(q)
      const tagsMatch = b.tags.some(t => t.toLowerCase().includes(q))
      return nameMatch || subtitleMatch || tagsMatch
    })
  }

  const filterByTags = (tags: string[]): Bookmark[] => {
    if (tags.length === 0) return []

    return bookmarks.value.filter(b => {
      return tags.every(tag => b.tags.includes(tag))
    })
  }

  const searchAndFilter = (query: string, tags: string[]): Bookmark[] => {
    let results = bookmarks.value

    if (query.trim()) {
      const q = query.toLowerCase().trim()
      results = results.filter(b => {
        const nameMatch = b.name.toLowerCase().includes(q)
        const subtitleMatch = b.subtitle?.toLowerCase().includes(q)
        const tagsMatch = b.tags.some(t => t.toLowerCase().includes(q))
        return nameMatch || subtitleMatch || tagsMatch
      })
    }

    if (tags.length > 0) {
      results = results.filter(b => {
        return tags.every(tag => b.tags.includes(tag))
      })
    }

    return results
  }

  const upsertLocal = (bookmark: Bookmark): void => {
    const idx = bookmarks.value.findIndex(b => b.id === bookmark.id)
    if (idx >= 0) bookmarks.value.splice(idx, 1, bookmark)
    else bookmarks.value.push(bookmark)
    saveToCache(CACHE_KEY, bookmarks.value)
  }

  const removeLocal = (id: string): void => {
    bookmarks.value = bookmarks.value.filter(b => b.id !== id && b.parentBookmarkId !== id)
    saveToCache(CACHE_KEY, bookmarks.value)
  }

  const create = async (input: BookmarkInput): Promise<Bookmark> => {
    const created = await apiCreateBookmark(input)
    upsertLocal(created)
    return created
  }

  const update = async (id: string, input: Partial<BookmarkInput>): Promise<Bookmark> => {
    const updated = await apiUpdateBookmark(id, input)
    upsertLocal(updated)
    return updated
  }

  const remove = async (id: string): Promise<void> => {
    await apiDeleteBookmark(id)
    removeLocal(id)
  }

  const uploadImage = async (id: string, file: File): Promise<Bookmark> => {
    const updated = await apiUploadImage(id, file)
    upsertLocal(updated)
    return updated
  }

  const removeImage = async (id: string): Promise<Bookmark> => {
    const updated = await apiDeleteImage(id)
    upsertLocal(updated)
    return updated
  }

  const getById = (id: string): Bookmark | undefined => {
    return bookmarks.value.find(b => b.id === id)
  }

  const invalidate = (): void => {
    clearCache(CACHE_KEY)
  }

  return {
    bookmarks,
    loading,
    refreshing,
    error,
    allTags,
    tagCounts,
    getAvailableTags,
    visibleBookmarks,
    loadBookmarks,
    getByCategory,
    getVisibleByCategory,
    getVisibleGroupsByCategory,
    searchAndFilterGroups,
    search,
    filterByTags,
    searchAndFilter,
    getById,
    create,
    update,
    remove,
    uploadImage,
    removeImage,
    invalidate
  }
})
