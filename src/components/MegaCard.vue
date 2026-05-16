<script setup lang="ts">
import type { Bookmark } from '@/types'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { resolveBookmarkHue } from '@/composables/useColorHue'
import { useCategoriesStore } from '@/stores/categories'
import { buildImageStyle } from '@/composables/useImageStyle'
import { useAltKey } from '@/composables/useAltKey'
import {
  useBookmarkDuplicate,
  buildDuplicatePayload,
} from '@/composables/useBookmarkDuplicate'
import MiniCard from './MiniCard.vue'

const router = useRouter()
const categoriesStore = useCategoriesStore()
const { isAltPressed } = useAltKey()
const { setPendingDuplicate } = useBookmarkDuplicate()

const props = defineProps<{
  parent: Bookmark
  children: Bookmark[]
}>()

const emit = defineEmits<{
  'tag-click': [tag: string]
}>()

const hue = computed(() => {
  const cat = props.parent.categoryId
    ? categoriesStore.getById(props.parent.categoryId)
    : null
  return resolveBookmarkHue(props.parent, cat?.color)
})

const childrenWithSearch = computed(() =>
  props.children.filter(child => Boolean(child.searchUrlTemplate)),
)

const searchMode = computed<'parent' | 'children' | 'none'>(() => {
  if (props.parent.searchUrlTemplate) return 'parent'
  if (childrenWithSearch.value.length >= 2) return 'children'
  return 'none'
})

const hasSearch = computed(() => searchMode.value !== 'none')

const searchPlaceholder = computed(() => {
  if (props.parent.searchPlaceholder) return props.parent.searchPlaceholder
  if (searchMode.value === 'children') {
    return `Buscar en ${childrenWithSearch.value.length} sites a la vez…`
  }
  return 'Buscar en el grupo…'
})

const imageStyle = computed(() => buildImageStyle(props.parent))

const initials = computed(() => {
  const trimmed = props.parent.name.trim()
  if (!trimmed) return '·'
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
})

const handleEditClick = async (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  if (event.altKey) {
    const payload = await buildDuplicatePayload(props.parent)
    setPendingDuplicate(payload)
    router.push('/edit')
    return
  }
  router.push(`/edit/${props.parent.id}`)
}

const handleAddChildClick = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  router.push({
    path: '/edit',
    query: {
      categoryId: props.parent.categoryId ?? '',
      parentBookmarkId: props.parent.id,
    },
  })
}

const searchQuery = ref('')
const handleSearchSubmit = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  const q = searchQuery.value.trim()
  if (!q) return

  if (searchMode.value === 'parent') {
    const tpl = props.parent.searchUrlTemplate
    if (!tpl) return
    window.open(tpl.replace('{q}', encodeURIComponent(q)), '_blank', 'noopener,noreferrer')
    return
  }

  if (searchMode.value === 'children') {
    childrenWithSearch.value.forEach(child => {
      const tpl = child.searchUrlTemplate
      if (!tpl) return
      window.open(tpl.replace('{q}', encodeURIComponent(q)), '_blank', 'noopener,noreferrer')
    })
  }
}

const handleTagClick = (tag: string) => {
  emit('tag-click', tag)
}
</script>

<template>
  <div
    class="megacard"
    :class="{ 'no-color': hue === null }"
    :style="hue !== null ? { '--c': hue } : {}"
  >
    <div class="megacard-head">
      <div class="card-thumb mega-thumb" :style="imageStyle.thumb">
        <img
          v-if="parent.imageUrl"
          :src="parent.imageUrl"
          :alt="parent.name"
          loading="lazy"
          :style="imageStyle.img"
        />
        <span v-else class="card-thumb-text">{{ initials }}</span>
      </div>
      <div class="megacard-title-block">
        <div class="megacard-title">{{ parent.name }}</div>
        <div v-if="parent.subtitle" class="megacard-sub">{{ parent.subtitle }}</div>
      </div>
      <span class="megacard-badge">{{ children.length }} sites</span>
      <button
        class="card-edit mega-edit"
        :title="`Nuevo bookmark en ${parent.name}`"
        :aria-label="`Nuevo bookmark en ${parent.name}`"
        @click="handleAddChildClick"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        class="card-edit mega-edit"
        :class="{ 'is-duplicate': isAltPressed }"
        :aria-label="isAltPressed ? `Duplicar ${parent.name}` : 'Editar'"
        :title="isAltPressed ? 'Duplicar mega card (sólo el padre)' : 'Editar (Alt para duplicar)'"
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
      </button>
    </div>

    <form v-if="hasSearch" class="megacard-search" @submit="handleSearchSubmit">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="searchPlaceholder"
      />
      <button type="submit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        {{ searchMode === 'children' ? `Buscar en ${childrenWithSearch.length}` : 'Buscar' }}
      </button>
    </form>

    <div v-if="parent.tags && parent.tags.length > 0" class="megacard-tags">
      <button
        v-for="tag in parent.tags.slice(0, 5)"
        :key="tag"
        class="card-tag"
        @click.prevent.stop="handleTagClick(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <div v-if="children.length > 0" class="megacard-children">
      <MiniCard v-for="child in children" :key="child.id" :bookmark="child" />
    </div>
  </div>
</template>

<style scoped>
.megacard {
  --c: 220;
  grid-column: span 2;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 18px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
  transition: box-shadow 160ms ease, border-color 160ms ease;
}
.megacard:hover {
  box-shadow: var(--shadow-md, 0 1px 3px rgba(28, 26, 20, 0.06), 0 8px 24px rgba(28, 26, 20, 0.05));
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
}
.megacard::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  background: oklch(0.65 0.16 var(--c));
}
.megacard::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 80% at 0% 0%, oklch(0.92 0.06 var(--c) / 0.32), transparent 55%);
  pointer-events: none;
}
.megacard.no-color::before,
.megacard.no-color::after { display: none; }
.megacard.no-color .megacard-badge {
  color: var(--fg-mid, #4a463c);
  background: var(--bg-soft, #f3f1ec);
  border-color: var(--border, rgba(28, 26, 20, 0.08));
}

.megacard-head {
  display: flex;
  gap: 12px;
  align-items: center;
  position: relative;
  z-index: 1;
}
.mega-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  overflow: hidden;
  font-weight: 600;
  font-size: 16px;
  color: var(--fg, #1c1a14);
}
.mega-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.megacard-title-block { flex: 1; min-width: 0; }
.megacard-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg, #1c1a14);
}
.megacard-sub {
  font-size: 11.5px;
  color: var(--fg-soft, #7a7468);
  margin-top: 1px;
}

.megacard-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: oklch(0.40 0.14 var(--c));
  background: oklch(0.95 0.04 var(--c));
  padding: 3px 7px;
  border-radius: 5px;
  border: 0.5px solid oklch(0.85 0.07 var(--c) / 0.6);
  white-space: nowrap;
}

.mega-edit {
  position: static;
  opacity: 0;
  flex-shrink: 0;
}
.megacard:hover .mega-edit { opacity: 1; }

.megacard-search {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 5px;
}
.megacard-search input {
  flex: 1;
  height: 30px;
  padding: 0 11px;
  font: inherit;
  font-size: 12.5px;
  border-radius: 8px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
  outline: none;
}
.megacard-search input:focus {
  border-color: var(--border-strong, rgba(28, 26, 20, 0.16));
  background: var(--bg-elev, #ffffff);
}
.megacard-search button {
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 0;
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.megacard-search button:hover { opacity: 0.88; }

.megacard-tags {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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

.megacard-children {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
  padding-top: 4px;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  margin-top: 2px;
}

.card-edit {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  transition: opacity 120ms ease, background 120ms ease;
}
.card-edit:hover { background: var(--bg-soft, #f3f1ec); color: var(--fg, #1c1a14); }

@media (max-width: 900px) {
  .megacard { grid-column: span 1; }
}
</style>
