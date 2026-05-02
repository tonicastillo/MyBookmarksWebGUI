<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
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
  isRefreshing,
  hasError,
  errorMessage,
  loadData,
  getCategoriesWithVisibleGroups,
  getFilteredGroups,
} = useBookmarks();
const bookmarksStore = useBookmarksStore();
const { searchQuery, debouncedQuery, clearSearch } = useSearch();
const { selectedTags, toggleTag, clearTags } = useTags();
const { getCacheTimestamp } = useCache();

const showTags = ref(false);
const now = ref(Date.now());
let tickInterval: ReturnType<typeof setInterval> | null = null;

const isFiltering = computed(() => {
  return debouncedQuery.value.trim() !== "" || selectedTags.value.length > 0;
});

const categoriesWithGroups = computed(() => {
  return getCategoriesWithVisibleGroups();
});

const filteredGroups = computed(() => {
  return getFilteredGroups(debouncedQuery.value, selectedTags.value);
});

const allTags = computed(() => bookmarksStore.allTags);
const tagCounts = computed(() => bookmarksStore.tagCounts);
const availableTags = computed(() => bookmarksStore.getAvailableTags(selectedTags.value));

const cacheTimestamp = computed(() => {
  // Depender de `now` para reevaluar tras cada tick y tras un refresh
  // (localStorage no es reactivo por sí mismo).
  void now.value;
  return getCacheTimestamp("bookmarks");
});

const timeAgo = computed(() => {
  const ts = cacheTimestamp.value;
  if (!ts) return null;

  const diff = now.value - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Sincronizado ahora";
  if (minutes === 1) return "Sincronizado hace 1 min";
  if (minutes < 60) return `Sincronizado hace ${minutes} min`;
  if (hours === 1) return "Sincronizado hace 1 h";
  if (hours < 24) return `Sincronizado hace ${hours} h`;
  if (days === 1) return "Sincronizado hace 1 día";
  return `Sincronizado hace ${days} días`;
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

watch(isRefreshing, (refreshing) => {
  if (!refreshing) now.value = Date.now();
});

onMounted(() => {
  loadData();
  // Actualizar el "hace X minutos" cada 30 segundos
  tickInterval = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval);
});
</script>

<template>
  <div class="home">
    <!-- Barra de refresco sutil -->
    <Transition name="refresh-bar">
      <div
        v-if="isRefreshing"
        class="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200 overflow-hidden"
      >
        <div class="h-full bg-blue-500 animate-progress-bar"></div>
      </div>
    </Transition>

    <!-- Barra de herramientas -->
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="search-wrap">
          <SearchBox v-model="searchQuery" />
        </div>
        <button
          @click="showTags = !showTags"
          class="tags-btn"
          :class="{ active: showTags || selectedTags.length > 0 }"
        >
          <svg
            class="tags-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <span>Tags</span>
          <span v-if="selectedTags.length > 0" class="tags-badge">
            {{ selectedTags.length }}
          </span>
        </button>
        <button
          v-if="!isLoading"
          @click="handleRefresh"
          class="refresh-btn"
          :class="{ spinning: isRefreshing }"
          :disabled="isRefreshing"
          title="Actualizar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
        <span v-if="timeAgo" class="sync-text">{{ timeAgo }}</span>
      </div>

      <!-- Filtros activos -->
      <div v-if="isFiltering" class="active-filters">
        <span class="active-label">Filtros activos:</span>
        <span v-if="debouncedQuery" class="chip">
          "{{ debouncedQuery }}"
        </span>
        <span v-for="tag in selectedTags" :key="tag" class="chip">
          {{ tag }}
          <button @click="toggleTag(tag)" class="chip-x" aria-label="Quitar">×</button>
        </span>
        <button @click="handleClearFilters" class="clear-all">
          Limpiar todo
        </button>
      </div>

      <!-- Panel de etiquetas -->
      <div v-if="showTags" class="tags-panel">
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
          v-if="filteredGroups.length === 0"
          title="Sin resultados"
          description="No se encontraron bookmarks con los filtros actuales."
        />
        <BookmarkList
          v-else
          :groups="filteredGroups"
          @tag-click="handleTagClick"
        />
      </template>

      <!-- Modo inicial: agrupado por categorías -->
      <template v-else>
        <EmptyState
          v-if="categoriesWithGroups.length === 0"
          title="Sin bookmarks"
          description="No hay bookmarks marcados como visibles al inicio."
        />
        <div v-else class="categories">
          <CategorySection
            v-for="{ category, groups } in categoriesWithGroups"
            :key="category.id"
            :id="`category-${category.id}`"
            :category="category"
            :groups="groups"
            @tag-click="handleTagClick"
          />
        </div>
      </template>
    </template>

  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-wrap {
  flex: 1;
  min-width: 0;
}

.tags-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 120ms ease;
}
.tags-btn:hover { opacity: 0.88; }
.tags-btn .tags-icon { color: currentColor; }
.tags-btn.active { box-shadow: 0 0 0 3px rgba(28, 26, 20, 0.08); }
.tags-badge {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
}

.refresh-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.1));
  border-radius: 12px;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.refresh-btn:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.refresh-btn:disabled { cursor: default; }
.refresh-btn.spinning svg {
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.sync-text {
  font-size: 12.5px;
  color: var(--fg-faint, #a8a294);
  margin-left: 4px;
  white-space: nowrap;
}

.active-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
}
.active-label {
  color: var(--fg-faint, #a8a294);
  margin-right: 2px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
  font-size: 12.5px;
}
.chip-x {
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 0 0 2px;
}
.chip-x:hover { color: var(--fg, #1c1a14); }
.clear-all {
  background: transparent;
  border: 0;
  color: var(--fg-soft, #7a7468);
  font-size: 12.5px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 6px;
}
.clear-all:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}

.tags-panel {
  padding: 18px 20px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 14px;
}

.categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes progress-bar {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0%); }
  100% { transform: translateX(100%); }
}

.animate-progress-bar {
  animation: progress-bar 1.5s ease-in-out infinite;
}

.refresh-bar-enter-active,
.refresh-bar-leave-active {
  transition: opacity 0.3s ease;
}

.refresh-bar-enter-from,
.refresh-bar-leave-to {
  opacity: 0;
}
</style>
