import { computed } from 'vue'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore, type CategoryNode } from '@/stores/categories'
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

  /** Modo inicial: agrupado por categoría con mega cards y sueltos.
   *  Recorre el árbol en pre-orden para que cada padre vaya seguido
   *  de sus hijos (los `order` de los hijos son relativos a su padre). */
  const getCategoriesWithVisibleGroups = (): CategoryWithGroups[] => {
    const result: CategoryWithGroups[] = []
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        const groups = bookmarksStore.getVisibleGroupsByCategory(node.id)
        if (groups.length > 0) {
          result.push({ category: node, groups })
        }
        walk(node.children)
      }
    }
    walk(categoriesStore.tree)
    return result
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
