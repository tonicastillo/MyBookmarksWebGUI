<script setup lang="ts">
import type { Bookmark } from '@/types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const hasSearch = computed(() => Boolean(props.bookmark.searchUrlTemplate))
const alternateUrls = computed(() => props.bookmark.alternateUrls ?? [])
const hasAlternateUrls = computed(() => alternateUrls.value.length > 0)

const showAlternateUrls = ref(false)
const altBtnRef = ref<HTMLButtonElement | null>(null)
const altPopoverRef = ref<HTMLElement | null>(null)
const altPopoverPos = ref<{ top: number; left: number } | null>(null)

const updateAltPopoverPos = () => {
  const btn = altBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  altPopoverPos.value = { top: rect.bottom + 4, left: rect.left }
}

const closeAlternateUrls = () => {
  showAlternateUrls.value = false
}

const toggleAlternateUrls = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  if (!showAlternateUrls.value) updateAltPopoverPos()
  showAlternateUrls.value = !showAlternateUrls.value
}

const handleDocClick = (event: MouseEvent) => {
  if (!showAlternateUrls.value) return
  const target = event.target as Node
  if (altBtnRef.value?.contains(target)) return
  if (altPopoverRef.value?.contains(target)) return
  showAlternateUrls.value = false
}

watch(showAlternateUrls, (open) => {
  if (open) {
    document.addEventListener('click', handleDocClick)
    window.addEventListener('scroll', updateAltPopoverPos, true)
    window.addEventListener('resize', updateAltPopoverPos)
  } else {
    document.removeEventListener('click', handleDocClick)
    window.removeEventListener('scroll', updateAltPopoverPos, true)
    window.removeEventListener('resize', updateAltPopoverPos)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  window.removeEventListener('scroll', updateAltPopoverPos, true)
  window.removeEventListener('resize', updateAltPopoverPos)
})

const initials = computed(() => {
  const trimmed = props.bookmark.name.trim()
  if (!trimmed) return '·'
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
})

const displayUrl = computed(() => {
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

const handleTagClick = (tag: string, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  emit('tag-click', tag)
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

    <div class="card-head">
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </form>

        <div v-if="hasAlternateUrls" class="card-alt-urls" @click="stop">
          <button
            ref="altBtnRef"
            type="button"
            class="card-alt-btn"
            :class="{ open: showAlternateUrls }"
            :aria-expanded="showAlternateUrls"
            :title="`${alternateUrls.length} URL${alternateUrls.length === 1 ? '' : 's'} alternativa${alternateUrls.length === 1 ? '' : 's'}`"
            aria-label="more urls"
            @click="toggleAlternateUrls"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.72-1.71" />
            </svg>
            <span>more urls</span>
            <span class="card-alt-count">{{ alternateUrls.length }}</span>
          </button>
        </div>
      </div>
    </div>

    <WidgetRenderer
      v-if="bookmark.widgets && bookmark.widgets.length > 0"
      :widgets="bookmark.widgets"
      class="card-widgets"
      @click="stop"
    />

    <a
      class="card-edit"
      :class="{ 'is-duplicate': isAltPressed }"
      :href="editHref"
      :aria-label="isAltPressed ? 'Duplicar' : 'Editar'"
      :title="isAltPressed ? 'Duplicar bookmark' : 'Editar (Alt para duplicar, Cmd+Click para nueva pestaña)'"
      @click="handleEditClick"
    >
      <svg v-if="!isAltPressed" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </a>
  </div>

  <Teleport to="body">
    <ul
      v-if="showAlternateUrls && hasAlternateUrls && altPopoverPos"
      ref="altPopoverRef"
      class="card-alt-list"
      role="menu"
      :style="{ top: `${altPopoverPos.top}px`, left: `${altPopoverPos.left}px` }"
    >
      <li v-for="(item, i) in alternateUrls" :key="i">
        <a
          :href="item.url"
          :title="item.url"
          target="_blank"
          rel="noopener noreferrer"
          @click="closeAlternateUrls"
        >
          {{ item.title || item.url }}
        </a>
      </li>
    </ul>
  </Teleport>
</template>

<style scoped>
.card {
  --c: 220;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 14px;
  padding: 12px 12px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: default;
  transition: box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease;
  position: relative;
  overflow: hidden;
  color: inherit;
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

.card-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-height: 52px;
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
  position: relative;
  z-index: 2;
  width: 100%;
  pointer-events: auto;
}

.card-alt-urls {
  margin-top: 6px;
  position: relative;
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
}
.card-alt-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg-soft, #7a7468);
  font: inherit;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.card-alt-btn:hover,
.card-alt-btn.open {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  border-color: var(--border-strong, rgba(28, 26, 20, 0.2));
}
.card-alt-count {
  display: inline-grid;
  place-items: center;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: 7px;
  background: oklch(0.65 0.16 var(--c) / 0.18);
  color: oklch(0.40 0.14 var(--c));
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1;
}
.card.no-color .card-alt-count {
  background: var(--bg-softer, #ecebe5);
  color: var(--fg-mid, #4a463c);
}
.card-alt-list {
  position: fixed;
  list-style: none;
  padding: 4px;
  margin: 0;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border-strong, rgba(28, 26, 20, 0.16));
  border-radius: 8px;
  box-shadow: var(--shadow-md, 0 4px 14px rgba(28, 26, 20, 0.12));
  min-width: 180px;
  max-width: 260px;
  z-index: 1000;
}
.card-alt-list li { margin: 0; }
.card-alt-list a {
  display: block;
  padding: 5px 9px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--fg, #1c1a14);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-alt-list a:hover { background: var(--bg-soft, #f3f1ec); }
</style>
