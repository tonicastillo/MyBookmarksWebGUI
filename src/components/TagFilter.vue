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

const isSelected = (tag: string) => props.selectedTags.includes(tag)

const isAvailable = (tag: string) => {
  if (props.selectedTags.length === 0) return true
  return props.availableTags.has(tag) || isSelected(tag)
}

const visibleTags = computed(() => {
  if (props.selectedTags.length === 0) return props.tags
  return props.tags.filter((tag) => isSelected(tag) || props.availableTags.has(tag))
})

const toggleTag = (tag: string) => {
  emit('toggle', tag)
}

const clearAll = () => {
  emit('clear')
}
</script>

<template>
  <div class="tag-filter">
    <div class="header">
      <div class="label">
        <span>TAGS</span>
        <span class="dot">·</span>
        <span>{{ visibleTags.length }}</span>
      </div>
      <button
        v-if="selectedTags.length > 0"
        @click="clearAll"
        class="clear"
      >
        Limpiar ({{ selectedTags.length }})
      </button>
    </div>

    <div class="pills">
      <button
        v-for="tag in visibleTags"
        :key="tag"
        @click="toggleTag(tag)"
        :class="[
          'pill',
          { selected: isSelected(tag), dimmed: !isAvailable(tag) }
        ]"
      >
        <span class="pill-name">{{ tag }}</span>
        <span class="pill-count">{{ tagCounts.get(tag) || 0 }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--fg-faint, #a8a294);
  text-transform: uppercase;
}
.label .dot {
  letter-spacing: 0;
}
.clear {
  font-size: 12px;
  color: var(--fg-soft, #7a7468);
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.clear:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font: inherit;
  font-size: 13px;
  line-height: 1.2;
  color: var(--fg-mid, #4a463c);
  background: var(--bg-soft, #f3f1ec);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
}
.pill:hover {
  background: var(--bg-softer, #ecebe5);
  color: var(--fg, #1c1a14);
}
.pill-count {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
}
.pill.selected {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  font-weight: 600;
}
.pill.selected .pill-count {
  color: rgba(255, 255, 255, 0.7);
}
.pill.dimmed {
  opacity: 0.4;
}
</style>
