<script setup lang="ts">
import type { Bookmark } from '@/types'
import { computed, ref } from 'vue'
import { resolveBookmarkHue } from '@/composables/useColorHue'
import { useCategoriesStore } from '@/stores/categories'
import { useEditDrawerStore } from '@/stores/editDrawer'
import { buildImageStyle } from '@/composables/useImageStyle'
import { useAltKey } from '@/composables/useAltKey'
import {
  useBookmarkDuplicate,
  buildDuplicatePayload,
} from '@/composables/useBookmarkDuplicate'
import WidgetRenderer from './widgets/WidgetRenderer.vue'

const categoriesStore = useCategoriesStore()
const editDrawer = useEditDrawerStore()
const { isAltPressed } = useAltKey()
const { setPendingDuplicate } = useBookmarkDuplicate()

const props = defineProps<{
  bookmark: Bookmark
}>()

const hue = computed(() => {
  const cat = props.bookmark.categoryId
    ? categoriesStore.getById(props.bookmark.categoryId)
    : null
  return resolveBookmarkHue(props.bookmark, cat?.color)
})
const hasUrl = computed(() => Boolean(props.bookmark.url))
const hasSearch = computed(() => Boolean(props.bookmark.searchUrlTemplate))
const hasWidgets = computed(() => Boolean(props.bookmark.widgets && props.bookmark.widgets.length > 0))
const isComplex = computed(() => hasSearch.value || hasWidgets.value)

const initials = computed(() => {
  const trimmed = props.bookmark.name.trim()
  if (!trimmed) return '·'
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
})

const displaySub = computed(() => {
  if (props.bookmark.subtitle) return props.bookmark.subtitle
  if (!props.bookmark.url) return ''
  try {
    return new URL(props.bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})

const editHref = computed(() => `/edit/${props.bookmark.id}`)

const handleEditClick = async (event: MouseEvent) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (event.altKey) {
    const payload = await buildDuplicatePayload(props.bookmark)
    setPendingDuplicate(payload)
    editDrawer.open()
    return
  }
  editDrawer.open({ bookmarkId: props.bookmark.id })
}

const searchQuery = ref('')
const handleSearchSubmit = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  const tpl = props.bookmark.searchUrlTemplate
  const q = searchQuery.value.trim()
  if (!tpl || !q) return
  window.open(tpl.replace('{q}', encodeURIComponent(q)), '_blank', 'noopener,noreferrer')
}

const stop = (event: Event) => {
  event.stopPropagation()
}

const imageStyle = computed(() => buildImageStyle(props.bookmark))
</script>

<template>
  <div
    v-if="isComplex"
    class="minicard has-search"
    :class="{ 'no-color': hue === null }"
    :style="hue !== null ? { '--c': hue } : {}"
  >
    <div class="minicard-row" :class="{ 'has-link': hasUrl }">
      <a
        v-if="hasUrl"
        class="minicard-link"
        :href="bookmark.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="bookmark.name"
      ></a>
      <div class="minicard-thumb" :style="imageStyle.thumb">
        <img v-if="bookmark.imageUrl" :src="bookmark.imageUrl" :alt="bookmark.name" loading="lazy" :style="imageStyle.img" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="minicard-body">
        <div class="minicard-title">{{ bookmark.name }}</div>
        <div v-if="displaySub" class="minicard-sub">{{ displaySub }}</div>
      </div>
      <a
        class="minicard-edit"
        :class="{ 'is-duplicate': isAltPressed }"
        :href="editHref"
        :aria-label="isAltPressed ? 'Duplicar' : 'Editar'"
        :title="isAltPressed ? 'Duplicar bookmark' : 'Editar (Alt para duplicar, Cmd+Click para nueva pestaña)'"
        @click="handleEditClick"
      >
        <svg v-if="!isAltPressed" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </a>
    </div>
    <form v-if="hasSearch" class="card-search" @submit="handleSearchSubmit" @click="stop">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="bookmark.searchPlaceholder || 'Buscar…'"
        @click.stop
      />
      <button type="submit" aria-label="Buscar">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
    </form>
    <WidgetRenderer
      v-if="hasWidgets"
      :widgets="bookmark.widgets"
      @click="stop"
    />
  </div>

  <div
    v-else
    class="minicard"
    :class="{ 'no-color': hue === null, 'has-link': hasUrl }"
    :style="hue !== null ? { '--c': hue } : {}"
  >
    <a
      v-if="hasUrl"
      class="minicard-link"
      :href="bookmark.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="bookmark.name"
    ></a>
    <div class="minicard-thumb" :style="imageStyle.thumb">
      <img v-if="bookmark.imageUrl" :src="bookmark.imageUrl" :alt="bookmark.name" loading="lazy" :style="imageStyle.img" />
      <span v-else>{{ initials }}</span>
    </div>
    <div class="minicard-body">
      <div class="minicard-title">{{ bookmark.name }}</div>
      <div v-if="displaySub" class="minicard-sub">{{ displaySub }}</div>
    </div>
    <a
      class="minicard-edit"
      :class="{ 'is-duplicate': isAltPressed }"
      :href="editHref"
      :aria-label="isAltPressed ? 'Duplicar' : 'Editar'"
      :title="isAltPressed ? 'Duplicar bookmark' : 'Editar (Alt para duplicar, Cmd+Click para nueva pestaña)'"
      @click="handleEditClick"
    >
      <svg v-if="!isAltPressed" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.minicard {
  --c: 220;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px 7px 11px;
  border-radius: 9px;
  color: var(--fg, #1c1a14);
  cursor: default;
  position: relative;
  transition: background 120ms ease;
  min-width: 0;
  overflow: hidden;
  background: transparent;
}
.minicard.has-link { cursor: pointer; }
.minicard::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 2px;
  background: oklch(0.65 0.16 var(--c));
  transition: top 120ms ease, bottom 120ms ease;
}
.minicard:hover { background: var(--bg-soft, #f3f1ec); }
.minicard:hover::before { top: 6px; bottom: 6px; }
.minicard.no-color::before { display: none; }
.minicard.no-color { padding-left: 8px; }

.minicard-link {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  text-decoration: none;
}

.minicard-thumb {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 11px;
  color: var(--fg, #1c1a14);
  background: var(--bg, #faf9f7);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  overflow: hidden;
  pointer-events: none;
  position: relative;
  z-index: 2;
}
.minicard-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.minicard-body {
  min-width: 0;
  flex: 1;
  position: relative;
  z-index: 2;
  pointer-events: none;
}
.minicard-title {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  color: var(--fg, #1c1a14);
}
.minicard-sub {
  font-size: 10.5px;
  color: var(--fg-faint, #a8a294);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.minicard-edit {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  opacity: 0;
  flex-shrink: 0;
  position: relative;
  z-index: 3;
  text-decoration: none;
}
.minicard:hover .minicard-edit,
.minicard.has-search .minicard-row:hover .minicard-edit { opacity: 1; }
.minicard-edit:hover { background: var(--bg-softer, #ecebe5); color: var(--fg, #1c1a14); }
.minicard-edit:focus-visible { opacity: 1; outline: 2px solid var(--fg, #1c1a14); outline-offset: 2px; }

.minicard.has-search {
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  padding: 8px;
  background: transparent;
  cursor: default;
}
.minicard.has-search .minicard-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  border-radius: 6px;
  padding: 2px;
  position: relative;
  cursor: default;
}
.minicard.has-search .minicard-row.has-link { cursor: pointer; }
.minicard.has-search .minicard-row:hover { background: var(--bg-soft, #f3f1ec); }

.card-search {
  display: flex;
  gap: 4px;
  position: relative;
  z-index: 2;
}
.card-search input {
  flex: 1;
  height: 22px;
  padding: 0 8px;
  font: inherit;
  font-size: 11px;
  border-radius: 6px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
  outline: none;
  min-width: 0;
}
.card-search input:focus {
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
}
.card-search button {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg-mid, #4a463c);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
.card-search button:hover {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border-color: var(--fg, #1c1a14);
}
</style>
