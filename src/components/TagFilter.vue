<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tags: string[]
  selectedTags: string[]
  tagCounts: Map<string, number>
  availableTags: Set<string>
}>()

const emit = defineEmits<{
  'toggle': [tag: string]
  'clear': []
}>()

const maxCount = computed(() => {
  let max = 0
  props.tagCounts.forEach(count => {
    if (count > max) max = count
  })
  return max
})

const getImportanceLevel = (tag: string): number => {
  const count = props.tagCounts.get(tag) || 0
  const max = maxCount.value
  if (max === 0) return 1

  const ratio = count / max
  if (ratio >= 0.8) return 5
  if (ratio >= 0.6) return 4
  if (ratio >= 0.4) return 3
  if (ratio >= 0.2) return 2
  return 1
}

const getTagClasses = (tag: string, isSelected: boolean): string => {
  if (isSelected) {
    return 'bg-blue-600 text-white'
  }

  const level = getImportanceLevel(tag)
  const styles: Record<number, string> = {
    5: 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold',
    4: 'bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium',
    3: 'bg-sky-100 text-sky-700 border border-sky-200',
    2: 'bg-slate-100 text-slate-600 border border-slate-200',
    1: 'bg-gray-50 text-gray-500 border border-gray-200 text-xs'
  }
  return styles[level]
}

const isSelected = (tag: string) => props.selectedTags.includes(tag)

const visibleTags = computed(() => {
  if (props.selectedTags.length === 0) {
    return props.tags
  }
  return props.tags.filter(tag =>
    props.selectedTags.includes(tag) || props.availableTags.has(tag)
  )
})

const toggleTag = (tag: string) => {
  emit('toggle', tag)
}

const clearAll = () => {
  emit('clear')
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-gray-700">Etiquetas</h3>
      <button
        v-if="selectedTags.length > 0"
        @click="clearAll"
        class="text-xs text-blue-600 hover:text-blue-800"
      >
        Limpiar ({{ selectedTags.length }})
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tag in visibleTags"
        :key="tag"
        @click="toggleTag(tag)"
        :class="[
          'px-3 py-1 text-sm rounded-full transition-colors hover:opacity-80',
          getTagClasses(tag, isSelected(tag))
        ]"
      >
        {{ tag }} <span class="opacity-60">({{ tagCounts.get(tag) || 0 }})</span>
      </button>
    </div>
  </div>
</template>
