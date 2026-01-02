<script setup lang="ts">
import type { Category, Bookmark } from '@/types'
import BookmarkCard from './BookmarkCard.vue'

defineProps<{
  category: Category
  bookmarks: Bookmark[]
}>()

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const handleTagClick = (tag: string) => {
  emit('tag-click', tag)
}
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
      {{ category.name }}
      <span class="text-sm font-normal text-gray-500 ml-2">({{ bookmarks.length }})</span>
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <BookmarkCard
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        @tag-click="handleTagClick"
      />
    </div>
  </section>
</template>
