<script setup lang="ts">
import type { Bookmark } from '@/types'
import { computed, ref } from 'vue'
import { resolveBookmarkHue } from '@/composables/useColorHue'

const props = defineProps<{
  bookmark: Bookmark
}>()

const hue = computed(() => resolveBookmarkHue(props.bookmark))
const hasUrl = computed(() => Boolean(props.bookmark.url))
const hasSearch = computed(() => Boolean(props.bookmark.searchUrlTemplate))

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

const notionUrl = computed(() => {
  const cleanId = props.bookmark.id.replace(/-/g, '')
  return `https://www.notion.so/${cleanId}`
})

const handleEditClick = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  window.open(notionUrl.value, '_blank', 'noopener,noreferrer')
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

const rowTag = computed(() => (hasUrl.value ? 'a' : 'div'))
</script>

<template>
  <div
    v-if="hasSearch"
    class="minicard has-search"
    :class="{ 'no-color': bookmark.colorHue === undefined && !bookmark.categoryId }"
    :style="{ '--c': hue }"
  >
    <component
      :is="rowTag"
      :href="hasUrl ? bookmark.url : undefined"
      :target="hasUrl ? '_blank' : undefined"
      :rel="hasUrl ? 'noopener noreferrer' : undefined"
      class="minicard-row"
    >
      <div class="minicard-thumb">
        <img v-if="bookmark.imageUrl" :src="bookmark.imageUrl" :alt="bookmark.name" loading="lazy" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="minicard-body">
        <div class="minicard-title">{{ bookmark.name }}</div>
        <div v-if="displaySub" class="minicard-sub">{{ displaySub }}</div>
      </div>
      <button class="minicard-edit" aria-label="Editar" @click="handleEditClick">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </component>
    <form class="card-search" @submit="handleSearchSubmit" @click="stop">
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
  </div>

  <component
    v-else
    :is="rowTag"
    :href="hasUrl ? bookmark.url : undefined"
    :target="hasUrl ? '_blank' : undefined"
    :rel="hasUrl ? 'noopener noreferrer' : undefined"
    class="minicard"
    :class="{ 'no-color': bookmark.colorHue === undefined && !bookmark.categoryId }"
    :style="{ '--c': hue }"
  >
    <div class="minicard-thumb">
      <img v-if="bookmark.imageUrl" :src="bookmark.imageUrl" :alt="bookmark.name" loading="lazy" />
      <span v-else>{{ initials }}</span>
    </div>
    <div class="minicard-body">
      <div class="minicard-title">{{ bookmark.name }}</div>
      <div v-if="displaySub" class="minicard-sub">{{ displaySub }}</div>
    </div>
    <button class="minicard-edit" aria-label="Editar" @click="handleEditClick">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  </component>
</template>

<style scoped>
.minicard {
  --c: 220;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px 7px 11px;
  border-radius: 9px;
  text-decoration: none;
  color: var(--fg, #1c1a14);
  cursor: default;
  position: relative;
  transition: background 120ms ease;
  min-width: 0;
  overflow: hidden;
  background: transparent;
}
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
}
.minicard-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.minicard-body { min-width: 0; flex: 1; }
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
}
.minicard:hover .minicard-edit,
.minicard.has-search .minicard-row:hover .minicard-edit { opacity: 1; }
.minicard-edit:hover { background: var(--bg-softer, #ecebe5); color: var(--fg, #1c1a14); }

.minicard.has-search {
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  padding: 8px;
  background: transparent;
}
.minicard.has-search .minicard-row {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  border-radius: 6px;
  padding: 2px;
}
.minicard.has-search .minicard-row:hover { background: var(--bg-soft, #f3f1ec); }

.card-search {
  display: flex;
  gap: 4px;
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
