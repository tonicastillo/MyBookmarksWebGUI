import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category } from '@/types'
import {
  fetchCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategoryById as apiDeleteCategory,
  reorderCategories as apiReorderCategories,
  type CategoryInput,
  type CategoryReorderEntry
} from '@/api/notion'
import { useCache } from '@/composables/useCache'

export interface CategoryNode extends Category {
  children: CategoryNode[]
}

const CACHE_KEY = 'categories'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const { saveToCache, getFromCache, isCacheValid, clearCache } = useCache()

  const orderedCategories = computed(() => {
    return [...categories.value].sort((a, b) => a.order - b.order)
  })

  const rootCategories = computed(() => {
    return orderedCategories.value.filter(c => !c.padreId)
  })

  const tree = computed<CategoryNode[]>(() => {
    const byParent = new Map<string | null, Category[]>()
    for (const c of orderedCategories.value) {
      const key = c.padreId ?? null
      const arr = byParent.get(key) ?? []
      arr.push(c)
      byParent.set(key, arr)
    }
    const build = (parentId: string | null): CategoryNode[] =>
      (byParent.get(parentId) ?? []).map(c => ({ ...c, children: build(c.id) }))
    return build(null)
  })

  const refreshing = ref(false)

  const loadCategories = async (forceRefresh = false): Promise<void> => {
    const cached = getFromCache<Category[]>(CACHE_KEY)
    const hasCachedData = cached && cached.length > 0

    if (hasCachedData) {
      categories.value = cached
      if (!forceRefresh && isCacheValid(CACHE_KEY)) {
        return
      }
    }

    if (!hasCachedData) {
      loading.value = true
    } else {
      refreshing.value = true
    }
    error.value = null

    try {
      const data = await fetchCategories()
      categories.value = data
      saveToCache(CACHE_KEY, data)
    } catch (e) {
      if (!hasCachedData) {
        error.value = e instanceof Error ? e.message : 'Error loading categories'
      }
      console.error('Error loading categories:', e)
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  const getById = (id: string): Category | undefined => {
    return categories.value.find(c => c.id === id)
  }

  const getChildren = (parentId: string): Category[] => {
    return orderedCategories.value.filter(c => c.padreId === parentId)
  }

  const upsertLocal = (category: Category): void => {
    const idx = categories.value.findIndex(c => c.id === category.id)
    if (idx >= 0) categories.value.splice(idx, 1, category)
    else categories.value.push(category)
    saveToCache(CACHE_KEY, categories.value)
  }

  const removeLocal = (id: string): void => {
    categories.value = categories.value.filter(c => c.id !== id)
    saveToCache(CACHE_KEY, categories.value)
  }

  const create = async (input: CategoryInput): Promise<Category> => {
    const created = await apiCreateCategory(input)
    upsertLocal(created)
    return created
  }

  const update = async (id: string, input: Partial<CategoryInput>): Promise<Category> => {
    const updated = await apiUpdateCategory(id, input)
    upsertLocal(updated)
    return updated
  }

  const remove = async (id: string): Promise<void> => {
    await apiDeleteCategory(id)
    removeLocal(id)
  }

  const reorderTree = async (updates: CategoryReorderEntry[]): Promise<void> => {
    const fresh = await apiReorderCategories(updates)
    categories.value = fresh
    saveToCache(CACHE_KEY, fresh)
  }

  const invalidate = (): void => {
    clearCache(CACHE_KEY)
  }

  return {
    categories,
    loading,
    refreshing,
    error,
    orderedCategories,
    rootCategories,
    tree,
    loadCategories,
    getById,
    getChildren,
    create,
    update,
    remove,
    reorderTree,
    invalidate
  }
})
