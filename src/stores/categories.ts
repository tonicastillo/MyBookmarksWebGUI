import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category } from '@/types'
import { fetchCategories } from '@/api/notion'
import { useCache } from '@/composables/useCache'

const CACHE_KEY = 'categories'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const { saveToCache, getFromCache, isCacheValid } = useCache()

  const orderedCategories = computed(() => {
    return [...categories.value].sort((a, b) => a.order - b.order)
  })

  const rootCategories = computed(() => {
    return orderedCategories.value.filter(c => !c.padreId)
  })

  const loadCategories = async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && isCacheValid(CACHE_KEY)) {
      const cached = getFromCache<Category[]>(CACHE_KEY)
      if (cached) {
        categories.value = cached
        return
      }
    }

    loading.value = true
    error.value = null

    try {
      const data = await fetchCategories()
      categories.value = data
      saveToCache(CACHE_KEY, data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error loading categories'
      console.error('Error loading categories:', e)
    } finally {
      loading.value = false
    }
  }

  const getById = (id: string): Category | undefined => {
    return categories.value.find(c => c.id === id)
  }

  const getChildren = (parentId: string): Category[] => {
    return orderedCategories.value.filter(c => c.padreId === parentId)
  }

  return {
    categories,
    loading,
    error,
    orderedCategories,
    rootCategories,
    loadCategories,
    getById,
    getChildren
  }
})
