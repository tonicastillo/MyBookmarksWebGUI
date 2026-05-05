import { computed } from 'vue'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore } from '@/stores/categories'
import type { Category } from '@/types'
import type { BookmarkGroup } from '@/composables/useBookmarkGroups'

export interface CategoryWithGroups {
  category: Category
  groups: BookmarkGroup[]
}

export const useBookmarks = () => {
  const bookmarksStore = useBookmarksStore()
  const categoriesStore = useCategoriesStore()

  const isLoading = computed(() => bookmarksStore.loading || categoriesStore.loading)
  const isRefreshing = computed(() => bookmarksStore.refreshing || categoriesStore.refreshing)
  const hasError = computed(() => bookmarksStore.error || categoriesStore.error)
  const errorMessage = computed(() => bookmarksStore.error || categoriesStore.error)

  const loadData = async (forceRefresh = false) => {
    await Promise.all([
      bookmarksStore.loadBookmarks(forceRefresh),
      categoriesStore.loadCategories(forceRefresh)
    ])
  }

  /** Modo inicial: agrupado por categoría con mega cards y sueltos. */
  const getCategoriesWithVisibleGroups = (): CategoryWithGroups[] => {
    return categoriesStore.orderedCategories
      .map(category => ({
        category,
        groups: bookmarksStore.getVisibleGroupsByCategory(category.id)
      }))
      .filter(item => item.groups.length > 0)
  }

  /** Modo filtrado: lista plana de grupos (mega cards + sueltos). */
  const getFilteredGroups = (query: string, tags: string[], categoryIds?: string[]): BookmarkGroup[] => {
    return bookmarksStore.searchAndFilterGroups(query, tags, categoryIds)
  }

  return {
    isLoading,
    isRefreshing,
    hasError,
    errorMessage,
    loadData,
    getCategoriesWithVisibleGroups,
    getFilteredGroups
  }
}
