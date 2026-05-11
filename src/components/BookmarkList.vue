<script setup lang="ts">
import type { BookmarkGroup } from '@/composables/useBookmarkGroups'
import BookmarkCard from './BookmarkCard.vue'
import MegaCard from './MegaCard.vue'

const props = defineProps<{
  groups: BookmarkGroup[]
}>()

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const handleTagClick = (tag: string) => {
  emit('tag-click', tag)
}

const totalCount = () => props.groups.reduce((acc, g) => acc + 1 + g.children.length, 0)
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-500">
      {{ totalCount() }} resultado{{ totalCount() !== 1 ? 's' : '' }}
    </p>

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
  </div>
</template>

<style scoped>
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
