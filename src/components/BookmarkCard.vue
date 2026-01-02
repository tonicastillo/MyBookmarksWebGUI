<script setup lang="ts">
import type { Bookmark } from "@/types";
import { computed } from "vue";

const props = defineProps<{
  bookmark: Bookmark;
}>();

const emit = defineEmits<{
  "tag-click": [tag: string];
}>();

const handleTagClick = (tag: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  emit("tag-click", tag);
};

const notionUrl = computed(() => {
  const cleanId = props.bookmark.id.replace(/-/g, "");
  return `https://www.notion.so/${cleanId}`;
});

const displayUrl = computed(() => {
  try {
    const url = new URL(props.bookmark.url);
    return url.hostname + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return props.bookmark.url;
  }
});

const handleEditClick = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  window.open(notionUrl.value, "_blank");
};
</script>

<template>
  <a
    :href="bookmark.url"
    target="_blank"
    rel="noopener noreferrer"
    class="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
  >
    <div class="flex gap-4">
      <div v-if="bookmark.imageUrl" class="flex-shrink-0">
        <img
          :src="bookmark.imageUrl"
          :alt="bookmark.name"
          class="w-16 h-16 object-cover rounded-md"
          loading="lazy"
        />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <h3
            class="text-base font-medium text-gray-900 group-hover:text-blue-600 truncate"
          >
            {{ bookmark.name }}
          </h3>
          <button
            @click="handleEditClick"
            class="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Editar en Notion"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
              />
            </svg>
          </button>
        </div>

        <p class="text-xs text-gray-400 truncate mt-0.5">
          {{ displayUrl }}
        </p>

        <p
          v-if="bookmark.subtitle"
          class="mt-1 text-sm text-gray-500 line-clamp-2"
        >
          {{ bookmark.subtitle }}
        </p>

        <div v-if="bookmark.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="tag in bookmark.tags.slice(0, 5)"
            :key="tag"
            @click="handleTagClick(tag, $event)"
            class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-700"
          >
            {{ tag }}
          </button>
          <span
            v-if="bookmark.tags.length > 5"
            class="px-2 py-0.5 text-xs text-gray-400"
          >
            +{{ bookmark.tags.length - 5 }}
          </span>
        </div>

        <div v-if="bookmark.valoration" class="mt-2 text-sm">
          {{ bookmark.valoration }}
        </div>
      </div>
    </div>
  </a>
</template>
