<script setup lang="ts">
import type { Category } from '@/types'
import type { BookmarkGroup } from '@/composables/useBookmarkGroups'
import BookmarkCard from './BookmarkCard.vue'
import MegaCard from './MegaCard.vue'

defineProps<{
  category: Category
  groups: BookmarkGroup[]
}>()

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const handleTagClick = (tag: string) => {
  emit('tag-click', tag)
}
</script>

<template>
  <section class="cat-section">
    <header class="cat-header">
      <h2>{{ category.name }}</h2>
      <span class="count">{{ groups.length }}</span>
      <hr />
    </header>

    <div class="cards">
      <template v-for="g in groups" :key="g.bookmark.id">
        <MegaCard
          v-if="g.children.length > 0"
          :parent="g.bookmark"
          :children="g.children"
          @tag-click="handleTagClick"
        />
        <BookmarkCard
          v-else
          :bookmark="g.bookmark"
          @tag-click="handleTagClick"
        />
      </template>
    </div>
  </section>
</template>

<style scoped>
.cat-section {
  margin-bottom: 32px;
  scroll-margin-top: 70px;
}
.cat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 14px;
}
.cat-header h2 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--fg, #1c1a14);
}
.cat-header .count {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
}
.cat-header hr {
  flex: 1;
  border: 0;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  margin: 0 0 0 6px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
</style>
