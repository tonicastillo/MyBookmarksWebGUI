import { ref, watch } from 'vue'

const DEBOUNCE_MS = 300

const searchQuery = ref('')
const debouncedQuery = ref('')
let timeoutId: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (newValue) => {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    debouncedQuery.value = newValue
  }, DEBOUNCE_MS)
})

const clearSearch = () => {
  searchQuery.value = ''
  debouncedQuery.value = ''
  if (timeoutId) clearTimeout(timeoutId)
}

export const useSearch = () => ({
  searchQuery,
  debouncedQuery,
  clearSearch,
})
