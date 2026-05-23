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

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const hue = computed(() => {
  const cat = props.bookmark.categoryId
    ? categoriesStore.getById(props.bookmark.categoryId)
    : null
  return resolveBookmarkHue(props.bookmark, cat?.color)
})

const hasUrl = computed(() => Boolean(props.bookmark.url))

const hasSearch = computed(() =>
  Boolean(props.bookmark.searchUrlTemplate)
)

const displayUrl = computed(() => {
  if (!props.bookmark.url) return ''
  try {
    const u = new URL(props.bookmark.url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})

const initials = computed(() => {
  const trimmed = props.bookmark.name.trim()
  if (!trimmed) return '·'
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
})

const handleTagClick = (tag: string, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('tag-click', tag)
}

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
  const url = tpl.replace('{q}', encodeURIComponent(q))
  window.open(url, '_blank', 'noopener,noreferrer')
}

const stop = (event: Event) => {
  event.stopPropagation()
}

const imageStyle = computed(() => buildImageStyle(props.bookmark))
</script>

<template>
  <div
    class="card"
    :class="{ 'no-color': hue === null, 'has-link': hasUrl }"
    :style="hue !== null ? { '--c': hue } : {}"
  >
    <a
      v-if="hasUrl"
      class="card-link"
      :href="bookmark.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="bookmark.name"
    ></a>

    <div class="card-thumb" :style="imageStyle.thumb">
      <img
        v-if="bookmark.imageUrl"
        :src="bookmark.imageUrl"
        :alt="bookmark.name"
        loading="lazy"
        :style="imageStyle.img"
      />
      <span v-else class="card-thumb-text">{{ initials }}</span>
    </div>

    <div class="card-body">
      <div class="card-title">{{ bookmark.name }}</div>

      <div v-if="bookmark.subtitle || displayUrl" class="card-sub">
        {{ bookmark.subtitle || displayUrl }}
      </div>

      <div v-if="bookmark.tags.length > 0" class="card-tags">
        <button
          v-for="tag in bookmark.tags.slice(0, 3)"
          :key="tag"
          class="card-tag"
          @click="handleTagClick(tag, $event)"
        >
          {{ tag }}
        </button>
      </div>

      <form
        v-if="hasSearch"
        class="card-search"
        @submit="handleSearchSubmit"
        @click="stop"
      >
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="bookmark.searchPlaceholder || 'Buscar…'"
          @click.stop.prevent
        />
        <button type="submit" aria-label="Buscar">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      <WidgetRenderer
        v-if="bookmark.widgets && bookmark.widgets.length > 0"
        :widgets="bookmark.widgets"
        class="card-widgets"
        @click="stop"
      />
    </div>

    <a
      class="card-edit"
      :class="{ 'is-duplicate': isAltPressed }"
      :href="editHref"
      :aria-label="isAltPressed ? 'Duplicar' : 'Editar'"
      :title="isAltPressed ? 'Duplicar bookmark' : 'Editar (Alt para duplicar, Cmd+Click para nueva pestaña)'"
      @click="handleEditClick"
    >
      <svg
        v-if="!isAltPressed"
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.card {
  --c: 220;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 14px;
  padding: 12px 12px 12px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  cursor: default;
  transition: box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease;
  position: relative;
  overflow: hidden;
  color: inherit;
  min-height: 78px;
}
.card.has-link { cursor: pointer; }
.card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: oklch(0.65 0.16 var(--c));
  transition: width 160ms ease;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, oklch(0.92 0.06 var(--c) / 0) 100%);
  pointer-events: none;
  transition: background 200ms ease;
}
.card:hover {
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
  box-shadow: var(--shadow-md, 0 1px 3px rgba(28, 26, 20, 0.06), 0 8px 24px rgba(28, 26, 20, 0.05));
  transform: translateY(-1px);
}
.card:hover::before { width: 5px; }
.card:hover::after {
  background: linear-gradient(180deg, transparent 50%, oklch(0.92 0.10 var(--c) / 0.28) 100%);
}
.card.no-color::before,
.card.no-color::after { display: none; }
.card.no-color { padding-left: 12px; }

.card-link {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  text-decoration: none;
}

.card-thumb {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: -0.02em;
  color: var(--fg, #1c1a14);
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  position: relative;
  overflow: hidden;
  pointer-events: none;
}
.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.card-thumb-text { position: relative; z-index: 1; }

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  z-index: 2;
  pointer-events: none;
}
.card-title {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--fg, #1c1a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.card-sub {
  font-size: 11.5px;
  color: var(--fg-faint, #a8a294);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.card-tags {
  display: flex;
  gap: 4px;
  margin-top: 5px;
  flex-wrap: wrap;
  pointer-events: auto;
}
.card-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg-soft, #7a7468);
  font-weight: 500;
  border: 0;
  cursor: pointer;
}
.card-tag:hover { background: var(--bg-softer, #ecebe5); color: var(--fg, #1c1a14); }

.card-edit {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background 120ms ease;
  z-index: 3;
  text-decoration: none;
}
.card:hover .card-edit { opacity: 1; }
.card-edit:hover { background: var(--bg-soft, #f3f1ec); color: var(--fg, #1c1a14); }
.card-edit:focus-visible { opacity: 1; outline: 2px solid var(--fg, #1c1a14); outline-offset: 2px; }

.card-search {
  display: flex;
  gap: 4px;
  margin-top: 7px;
  pointer-events: auto;
}
.card-search input {
  flex: 1;
  height: 24px;
  padding: 0 8px;
  font: inherit;
  font-size: 11.5px;
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
  width: 24px;
  height: 24px;
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

.card-widgets {
  margin-top: 7px;
  pointer-events: auto;
}
</style>
