import { computed, ref } from 'vue'

export interface CategoryFilter {
  categoryIds: string[]
  label: string
}

const filter = ref<CategoryFilter | null>(null)

export const useCategoryFilter = () => {
  const isActive = computed(() => filter.value !== null)

  const setFilter = (categoryIds: string[], label: string) => {
    filter.value = { categoryIds, label }
  }

  const clearFilter = () => {
    filter.value = null
  }

  return {
    categoryFilter: filter,
    isActive,
    setFilter,
    clearFilter,
  }
}
