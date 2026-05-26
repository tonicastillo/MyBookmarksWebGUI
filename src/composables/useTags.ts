import { ref, computed } from 'vue'

const selectedTags = ref<string[]>([])

const hasSelectedTags = computed(() => selectedTags.value.length > 0)

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index === -1) {
    selectedTags.value.push(tag)
  } else {
    selectedTags.value.splice(index, 1)
  }
}

const isTagSelected = (tag: string): boolean => selectedTags.value.includes(tag)

const clearTags = () => {
  selectedTags.value = []
}

const selectTags = (tags: string[]) => {
  selectedTags.value = [...tags]
}

export const useTags = () => ({
  selectedTags,
  hasSelectedTags,
  toggleTag,
  isTagSelected,
  clearTags,
  selectTags,
})
