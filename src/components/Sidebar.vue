<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarks } from '@/composables/useBookmarks'
import { hueFromId } from '@/composables/useColorHue'

const router = useRouter()
const { getCategoriesWithVisibleGroups } = useBookmarks()

const items = computed(() =>
  getCategoriesWithVisibleGroups().map(({ category, groups }) => ({
    id: category.id,
    name: category.name,
    count: groups.length,
    hue: hueFromId(category.id),
  })),
)

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

watch(items, () => {
  // Re-observar cuando cambian las categorías (tras cargar datos)
  requestAnimationFrame(() => observe())
}, { flush: 'post' })

onMounted(() => {
  requestAnimationFrame(() => observe())
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

const handleClick = (id: string, event: MouseEvent) => {
  const target = document.getElementById(`category-${id}`)
  if (!target) return
  event.preventDefault()
  activeId.value = id
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        <li v-for="item in items" :key="item.id">
          <a
            :href="`#category-${item.id}`"
            class="nav-item"
            :class="{ active: activeId === item.id }"
            :style="{ '--c': item.hue }"
            @click="handleClick(item.id, $event)"
          >
            <span class="dot"></span>
            <span class="name">{{ item.name }}</span>
            <span class="count">{{ item.count }}</span>
          </a>
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

.nav-item {
  --c: 220;
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
</style>
