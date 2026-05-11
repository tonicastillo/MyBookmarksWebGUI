<script setup lang="ts">
import type { Category } from '@/types'
import type { BookmarkGroup } from '@/composables/useBookmarkGroups'
import { useRouter } from 'vue-router'
import BookmarkCard from './BookmarkCard.vue'
import MegaCard from './MegaCard.vue'

const props = defineProps<{
  category: Category
  groups: BookmarkGroup[]
}>()

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const router = useRouter()

const handleTagClick = (tag: string) => {
  emit('tag-click', tag)
}

const handleAddBookmark = () => {
  router.push({ path: '/edit', query: { categoryId: props.category.id } })
}
</script>

<template>
  <section class="cat-section" :data-category-id="category.id">
    <header class="cat-header">
      <h2>{{ category.name }}</h2>
      <span class="count">{{ groups.length }}</span>
      <button
        type="button"
        class="cat-add"
        :title="`Nuevo bookmark en ${category.name}`"
        :aria-label="`Nuevo bookmark en ${category.name}`"
        @click="handleAddBookmark"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <hr />
    </header>

    <div class="cards">
      <template v-for="g in groups" :key="g.bookmark.id">
        <MegaCard
          v-if="g.bookmark.isMegaCard"
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
.cat-add {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, background 120ms ease, color 120ms ease;
  padding: 0;
}
.cat-header:hover .cat-add,
.cat-add:focus-visible {
  opacity: 1;
}
.cat-add:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
@media (hover: none) {
  .cat-add { opacity: 1; }
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

@media (max-width: 480px) {
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
}
</style>
