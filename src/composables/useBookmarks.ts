import { computed } from 'vue'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore } from '@/stores/categories'
import type { Bookmark, Category } from '@/types'

export interface CategoryWithBookmarks {
  category: Category
  bookmarks: Bookmark[]
}

export const useBookmarks = () => {
  const bookmarksStore = useBookmarksStore()
  const categoriesStore = useCategoriesStore()

  const isLoading = computed(() => bookmarksStore.loading || categoriesStore.loading)
  const hasError = computed(() => bookmarksStore.error || categoriesStore.error)
  const errorMessage = computed(() => bookmarksStore.error || categoriesStore.error)

  const loadData = async (forceRefresh = false) => {
    await Promise.all([
      bookmarksStore.loadBookmarks(forceRefresh),
      categoriesStore.loadCategories(forceRefresh)
    ])
  }

  const getCategoriesWithVisibleBookmarks = (): CategoryWithBookmarks[] => {
    return categoriesStore.orderedCategories
      .map(category => ({
        category,
        bookmarks: bookmarksStore.getVisibleByCategory(category.id)
      }))
      .filter(item => item.bookmarks.length > 0)
  }

  const getFilteredBookmarks = (query: string, tags: string[]): Bookmark[] => {
    return bookmarksStore.searchAndFilter(query, tags)
  }

  const getCategoriesWithFilteredBookmarks = (query: string, tags: string[]): CategoryWithBookmarks[] => {
    const filtered = getFilteredBookmarks(query, tags)
    const categoryMap = new Map<string, Bookmark[]>()

    filtered.forEach(bookmark => {
      const catId = bookmark.categoryId || 'uncategorized'
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, [])
      }
      categoryMap.get(catId)!.push(bookmark)
    })

    return categoriesStore.orderedCategories
      .map(category => ({
        category,
        bookmarks: categoryMap.get(category.id) || []
      }))
      .filter(item => item.bookmarks.length > 0)
  }

  return {
    isLoading,
    hasError,
    errorMessage,
    loadData,
    getCategoriesWithVisibleBookmarks,
    getFilteredBookmarks,
    getCategoriesWithFilteredBookmarks
  }
}
