<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarks } from '@/composables/useBookmarks'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useCategoriesStore } from '@/stores/categories'
import { hueFromHex } from '@/composables/useColorHue'
import { useCategoryFilter } from '@/composables/useCategoryFilter'

const router = useRouter()
const { getCategoriesWithVisibleGroups } = useBookmarks()
const bookmarksStore = useBookmarksStore()
const categoriesStore = useCategoriesStore()
const { categoryFilter, setFilter } = useCategoryFilter()

// Mapa id → ids de todos sus descendientes (subcategorías recursivas).
const descendantMap = computed(() => {
  const childrenOf = new Map<string, string[]>()
  categoriesStore.categories.forEach((c) => {
    if (!c.padreId) return
    const arr = childrenOf.get(c.padreId) ?? []
    arr.push(c.id)
    childrenOf.set(c.padreId, arr)
  })

  const map = new Map<string, string[]>()
  const collect = (id: string): string[] => {
    if (map.has(id)) return map.get(id) as string[]
    const direct = childrenOf.get(id) ?? []
    const all: string[] = [...direct]
    direct.forEach((childId) => {
      all.push(...collect(childId))
    })
    map.set(id, all)
    return all
  }
  categoriesStore.categories.forEach((c) => collect(c.id))
  return map
})

// Subcategorías directas (con bookmarks) por categoría padre.
const subcategoriesByParent = computed(() => {
  const result = new Map<
    string,
    { id: string; name: string; count: number; hue: number | null }[]
  >()
  const all = categoriesStore.orderedCategories

  all.forEach((parent) => {
    const directChildren = all.filter((c) => c.padreId === parent.id)
    const list = directChildren
      .map((sub) => {
        const subTreeIds = [sub.id, ...(descendantMap.value.get(sub.id) ?? [])]
        const count = bookmarksStore.bookmarks.filter(
          (b) => b.categoryId && subTreeIds.includes(b.categoryId),
        ).length
        return { id: sub.id, name: sub.name, count, hue: hueFromHex(sub.color) }
      })
      .filter((s) => s.count > 0)
    if (list.length > 0) result.set(parent.id, list)
  })

  return result
})

const items = computed(() => {
  const all = getCategoriesWithVisibleGroups()
  const groupCountById = new Map<string, number>()
  all.forEach(({ category, groups }) => groupCountById.set(category.id, groups.length))

  return all
    .filter(({ category }) => !category.padreId)
    .map(({ category }) => {
      const ids = [category.id, ...(descendantMap.value.get(category.id) ?? [])]
      const count = ids.reduce((sum, id) => sum + (groupCountById.get(id) ?? 0), 0)
      return {
        id: category.id,
        name: category.name,
        count,
        hue: hueFromHex(category.color),
        hasSubcategories: subcategoriesByParent.value.has(category.id),
      }
    })
})

const directCountFor = (id: string): number => {
  return bookmarksStore.bookmarks.filter((b) => b.categoryId === id).length
}

const totalCountFor = (id: string): number => {
  const ids = [id, ...(descendantMap.value.get(id) ?? [])]
  return bookmarksStore.bookmarks.filter((b) => b.categoryId && ids.includes(b.categoryId)).length
}

const expandedId = ref<string | null>(null)

const toggleExpand = (id: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  expandedId.value = expandedId.value === id ? null : id
}

const activeId = ref<string | null>(null)

let observer: IntersectionObserver | null = null
const visibleEntries = new Map<string, number>()

const recomputeActive = () => {
  let bestId: string | null = null
  let bestRatio = -1
  visibleEntries.forEach((ratio, id) => {
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestId = id
    }
  })
  if (bestId) activeId.value = bestId
}

const observe = () => {
  if (observer) observer.disconnect()
  visibleEntries.clear()

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.categoryId
        if (!id) return
        if (entry.isIntersecting) {
          visibleEntries.set(id, entry.intersectionRatio)
        } else {
          visibleEntries.delete(id)
        }
      })
      recomputeActive()
    },
    {
      rootMargin: '-80px 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    },
  )

  document.querySelectorAll<HTMLElement>('[data-category-id]').forEach((el) => {
    observer!.observe(el)
  })
}

watch(
  items,
  () => {
    requestAnimationFrame(() => observe())
  },
  { flush: 'post' },
)

onMounted(() => {
  requestAnimationFrame(() => observe())
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

const fastScrollTo = (target: HTMLElement) => {
  const targetTop = target.getBoundingClientRect().top + window.scrollY
  const startTop = window.scrollY
  const distance = targetTop - startTop
  if (Math.abs(distance) < 1) return
  const duration = 180
  const startTime = performance.now()
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const step = (now: number) => {
    const elapsed = now - startTime
    const t = Math.min(elapsed / duration, 1)
    window.scrollTo(0, startTop + distance * easeOutCubic(t))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const handleClick = (id: string, event: MouseEvent) => {
  const target = document.getElementById(`category-${id}`)
  if (!target) return
  event.preventDefault()
  activeId.value = id
  fastScrollTo(target)
}

const applyAllInCategory = (parentId: string, parentName: string) => {
  const ids = [parentId, ...(descendantMap.value.get(parentId) ?? [])]
  setFilter(ids, parentName)
  expandedId.value = null
}

const applyMainOnly = (parentId: string, parentName: string) => {
  setFilter([parentId], `${parentName} · solo principal`)
  expandedId.value = null
}

const applySubcategory = (subId: string, subName: string) => {
  const ids = [subId, ...(descendantMap.value.get(subId) ?? [])]
  setFilter(ids, subName)
  expandedId.value = null
}

const isFilterActiveForIds = (ids: string[]): boolean => {
  const current = categoryFilter.value
  if (!current) return false
  if (current.categoryIds.length !== ids.length) return false
  const set = new Set(current.categoryIds)
  return ids.every((id) => set.has(id))
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo">M</div>
      <div class="brand-name">MyBookmarks</div>
    </div>

    <div class="quick-actions">
      <button class="quick-btn primary" @click="router.push('/edit')">
        + Nuevo bookmark
      </button>
      <button class="quick-btn" @click="router.push('/categories')">
        Gestionar categorías
      </button>
    </div>

    <nav v-if="items.length > 0" class="nav">
      <div class="nav-label">CATEGORIES</div>
      <ul class="nav-list">
        <li v-for="item in items" :key="item.id" class="nav-li">
          <div
            class="nav-row"
            :class="{ 'no-accent': item.hue === null }"
            :style="item.hue !== null ? { '--c': item.hue } : {}"
          >
            <a
              :href="`#category-${item.id}`"
              class="nav-item"
              :class="{ active: activeId === item.id }"
              @click="handleClick(item.id, $event)"
            >
              <span class="dot"></span>
              <span class="name">{{ item.name }}</span>
              <span class="count">{{ item.count }}</span>
            </a>
            <button
              v-if="item.hasSubcategories"
              type="button"
              class="chevron"
              :class="{ open: expandedId === item.id }"
              :aria-label="expandedId === item.id ? 'Cerrar subcategorías' : 'Abrir subcategorías'"
              :aria-expanded="expandedId === item.id"
              @click="toggleExpand(item.id, $event)"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <div v-if="expandedId === item.id" class="submenu">
            <button
              type="button"
              class="sub-item special"
              :class="{ active: isFilterActiveForIds([item.id, ...(descendantMap.get(item.id) ?? [])]) }"
              @click="applyAllInCategory(item.id, item.name)"
            >
              <span class="sub-icon" aria-hidden="true">∗</span>
              <span class="sub-name">Todos los elementos</span>
              <span class="sub-count">{{ totalCountFor(item.id) }}</span>
            </button>
            <button
              type="button"
              class="sub-item special"
              :class="{ active: isFilterActiveForIds([item.id]) }"
              @click="applyMainOnly(item.id, item.name)"
            >
              <span class="sub-icon" aria-hidden="true">·</span>
              <span class="sub-name">Solo en categoría principal</span>
              <span class="sub-count">{{ directCountFor(item.id) }}</span>
            </button>
            <button
              v-for="sub in subcategoriesByParent.get(item.id)"
              :key="sub.id"
              type="button"
              class="sub-item"
              :class="{
                active: isFilterActiveForIds([sub.id, ...(descendantMap.get(sub.id) ?? [])]),
                'no-accent': sub.hue === null,
              }"
              :style="sub.hue !== null ? { '--c': sub.hue } : {}"
              @click="applySubcategory(sub.id, sub.name)"
            >
              <span class="sub-dot"></span>
              <span class="sub-name">{{ sub.name }}</span>
              <span class="sub-count">{{ sub.count }}</span>
            </button>
          </div>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  flex-shrink: 0;
  padding: 22px 14px 22px 18px;
  border-right: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg, #faf9f7);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 4px 6px;
  margin-bottom: 28px;
}
.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.02em;
}
.brand-name {
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--fg, #1c1a14);
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 18px;
  padding: 0 6px;
}
.quick-btn {
  font: inherit;
  font-size: 12.5px;
  padding: 7px 10px;
  border-radius: 7px;
  border: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  color: var(--fg-mid, #4a463c);
  transition: background 120ms ease, color 120ms ease;
}
.quick-btn:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.quick-btn.primary {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  font-weight: 500;
}
.quick-btn.primary:hover {
  background: var(--fg-mid, #4a463c);
  color: var(--bg, #faf9f7);
}

.nav-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--fg-faint, #a8a294);
  padding: 0 8px;
  margin-bottom: 8px;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-li {
  display: flex;
  flex-direction: column;
}

.nav-row {
  --c: 220;
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 8px;
}

.nav-item {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px 7px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--fg, #1c1a14);
  font-size: 13.5px;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.nav-item:hover {
  background: var(--bg-soft, #f3f1ec);
}
.nav-item.active {
  background: var(--bg-soft, #f1efe9);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: oklch(0.6 0.16 var(--c));
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: oklch(0.65 0.16 var(--c));
  flex-shrink: 0;
}
.nav-row.no-accent .dot { background: transparent; }
.nav-row.no-accent .nav-item.active::before { background: transparent; }

.name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.count {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.nav-item.active .count {
  color: var(--fg-soft, #7a7468);
}

.chevron {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 26px;
  margin-left: 2px;
  border: 0;
  background: transparent;
  color: var(--fg-faint, #a8a294);
  border-radius: 6px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 160ms ease;
}
.chevron:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.chevron.open {
  color: var(--fg, #1c1a14);
  transform: rotate(180deg);
}

.submenu {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 4px 0 6px 18px;
  padding-left: 8px;
  border-left: 1px dashed var(--border, rgba(28, 26, 20, 0.12));
}

.sub-item {
  --c: 220;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 7px;
  color: var(--fg-mid, #4a463c);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.sub-item:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
.sub-item.active {
  background: var(--bg-soft, #f1efe9);
  color: var(--fg, #1c1a14);
  font-weight: 500;
}
.sub-item.special {
  color: var(--fg-mid, #4a463c);
}
.sub-icon {
  width: 14px;
  display: inline-grid;
  place-items: center;
  color: var(--fg-faint, #a8a294);
  font-weight: 600;
  flex-shrink: 0;
}
.sub-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: oklch(0.7 0.14 var(--c));
  flex-shrink: 0;
  margin-left: 4px;
}
.sub-item.no-accent .sub-dot { background: transparent; }
.sub-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub-count {
  font-size: 11.5px;
  color: var(--fg-faint, #a8a294);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
