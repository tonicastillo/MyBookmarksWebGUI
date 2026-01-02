<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useBookmarks } from "@/composables/useBookmarks";
import { useBookmarksStore } from "@/stores/bookmarks";
import { useSearch } from "@/composables/useSearch";
import { useTags } from "@/composables/useTags";
import SearchBox from "@/components/SearchBox.vue";
import TagFilter from "@/components/TagFilter.vue";
import CategorySection from "@/components/CategorySection.vue";
import BookmarkList from "@/components/BookmarkList.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import EmptyState from "@/components/EmptyState.vue";
import ErrorMessage from "@/components/ErrorMessage.vue";
import { useCache } from "@/composables/useCache";

const {
  isLoading,
  hasError,
  errorMessage,
  loadData,
  getCategoriesWithVisibleBookmarks,
  getFilteredBookmarks,
} = useBookmarks();
const bookmarksStore = useBookmarksStore();
const { searchQuery, debouncedQuery, clearSearch } = useSearch();
const { selectedTags, toggleTag, clearTags } = useTags();
const { getCacheTimestamp } = useCache();

const showTags = ref(false);

const isFiltering = computed(() => {
  return debouncedQuery.value.trim() !== "" || selectedTags.value.length > 0;
});

const categoriesWithBookmarks = computed(() => {
  return getCategoriesWithVisibleBookmarks();
});

const filteredBookmarks = computed(() => {
  return getFilteredBookmarks(debouncedQuery.value, selectedTags.value);
});

const allTags = computed(() => bookmarksStore.allTags);
const tagCounts = computed(() => bookmarksStore.tagCounts);
const availableTags = computed(() => bookmarksStore.getAvailableTags(selectedTags.value));

const lastUpdated = computed(() => {
  const timestamp = getCacheTimestamp("bookmarks");
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleString("es-ES");
});

const handleTagClick = (tag: string) => {
  if (!selectedTags.value.includes(tag)) {
    toggleTag(tag);
  }
  showTags.value = true;
};

const handleClearFilters = () => {
  clearSearch();
  clearTags();
};

const handleRefresh = async () => {
  await loadData(true);
};

const handleRetry = () => {
  loadData(true);
};

watch(selectedTags, (tags) => {
  if (tags.length > 0) {
    showTags.value = true;
  }
});

// watch(categoriesWithBookmarks, (newVal) => {
//   console.log("categoriesWithBookmarks:", newVal);
// });

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Barra de herramientas -->
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <SearchBox v-model="searchQuery" />
        </div>
        <button
          @click="showTags = !showTags"
          :class="[
            'px-4 py-2 rounded-lg border transition-colors',
            showTags || selectedTags.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
          ]"
        >
          Etiquetas
          <span
            v-if="selectedTags.length > 0"
            class="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full"
          >
            {{ selectedTags.length }}
          </span>
        </button>
        <button
          @click="handleRefresh"
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Actualizar datos"
        >
          <svg
            class="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <!-- Filtros activos -->
      <div v-if="isFiltering" class="flex items-center gap-2 text-sm">
        <span class="text-gray-500">Filtros activos:</span>
        <span
          v-if="debouncedQuery"
          class="px-2 py-1 bg-blue-100 text-blue-700 rounded"
        >
          "{{ debouncedQuery }}"
        </span>
        <span
          v-for="tag in selectedTags"
          :key="tag"
          class="px-2 py-1 bg-blue-100 text-blue-700 rounded flex items-center gap-1"
        >
          {{ tag }}
          <button @click="toggleTag(tag)" class="hover:text-blue-900">×</button>
        </span>
        <button
          @click="handleClearFilters"
          class="text-blue-600 hover:text-blue-800"
        >
          Limpiar todo
        </button>
      </div>

      <!-- Panel de etiquetas -->
      <div
        v-if="showTags"
        class="p-4 bg-gray-50 rounded-lg border border-gray-200"
      >
        <TagFilter
          :tags="allTags"
          :selected-tags="selectedTags"
          :tag-counts="tagCounts"
          :available-tags="availableTags"
          @toggle="toggleTag"
          @clear="clearTags"
        />
      </div>
    </div>

    <!-- Estado de carga -->
    <LoadingSpinner v-if="isLoading" message="Cargando bookmarks..." />

    <!-- Error -->
    <ErrorMessage
      v-else-if="hasError"
      :message="errorMessage || 'Error desconocido'"
      @retry="handleRetry"
    />

    <!-- Contenido -->
    <template v-else>
      <!-- Modo filtrado: lista plana -->
      <template v-if="isFiltering">
        <EmptyState
          v-if="filteredBookmarks.length === 0"
          title="Sin resultados"
          description="No se encontraron bookmarks con los filtros actuales."
        />
        <BookmarkList
          v-else
          :bookmarks="filteredBookmarks"
          @tag-click="handleTagClick"
        />
      </template>

      <!-- Modo inicial: agrupado por categorías -->
      <template v-else>
        <EmptyState
          v-if="categoriesWithBookmarks.length === 0"
          title="Sin bookmarks"
          description="No hay bookmarks marcados como visibles al inicio."
        />
        <div v-else class="space-y-8">
          <!-- Accesos rápidos a categorías -->
          <nav class="text-sm text-gray-600">
            <span class="font-medium text-gray-700">Ir a: </span>
            <template v-for="({ category }, index) in categoriesWithBookmarks" :key="category.id">
              <a
                :href="`#category-${category.id}`"
                class="text-blue-600 hover:text-blue-800 hover:underline"
              >{{ category.name }}</a>
              <span v-if="index < categoriesWithBookmarks.length - 1" class="mx-1">·</span>
            </template>
          </nav>

          <CategorySection
            v-for="{ category, bookmarks } in categoriesWithBookmarks"
            :key="category.id"
            :id="`category-${category.id}`"
            :category="category"
            :bookmarks="bookmarks"
            @tag-click="handleTagClick"
          />
        </div>
      </template>
    </template>

    <!-- Última actualización -->
    <p
      v-if="lastUpdated && !isLoading"
      class="text-xs text-gray-400 text-center"
    >
      Última actualización: {{ lastUpdated }}
    </p>
  </div>
</template>
