<script setup lang="ts">
import type { Bookmark } from '@/types'
import BookmarkCard from './BookmarkCard.vue'

defineProps<{
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
  <div class="space-y-4">
    <p class="text-sm text-gray-500">
      {{ bookmarks.length }} resultado{{ bookmarks.length !== 1 ? 's' : '' }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <BookmarkCard
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        @tag-click="handleTagClick"
      />
    </div>
  </div>
</template>
