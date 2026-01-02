import { ref, watch } from 'vue'

export const useSearch = (debounceMs = 300) => {
  const searchQuery = ref('')
  const debouncedQuery = ref('')
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  watch(searchQuery, (newValue) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      debouncedQuery.value = newValue
    }, debounceMs)
  })

  const clearSearch = () => {
    searchQuery.value = ''
    debouncedQuery.value = ''
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }

  return {
    searchQuery,
    debouncedQuery,
    clearSearch
  }
}
