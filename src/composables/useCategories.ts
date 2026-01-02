import { computed } from 'vue'
import { useCategoriesStore } from '@/stores/categories'

export const useCategories = () => {
  const store = useCategoriesStore()

  const categories = computed(() => store.orderedCategories)
  const rootCategories = computed(() => store.rootCategories)
  const isLoading = computed(() => store.loading)
  const hasError = computed(() => !!store.error)
  const errorMessage = computed(() => store.error)

  const loadCategories = (forceRefresh = false) => store.loadCategories(forceRefresh)
  const getById = (id: string) => store.getById(id)
  const getChildren = (parentId: string) => store.getChildren(parentId)

  return {
    categories,
    rootCategories,
    isLoading,
    hasError,
    errorMessage,
    loadCategories,
    getById,
    getChildren
  }
}
