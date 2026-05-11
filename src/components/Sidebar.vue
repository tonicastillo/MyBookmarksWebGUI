<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useBookmarks } from "@/composables/useBookmarks";
import { useBookmarksStore } from "@/stores/bookmarks";
import { useCategoriesStore } from "@/stores/categories";
import { hueFromHex } from "@/composables/useColorHue";
import { useCategoryFilter } from "@/composables/useCategoryFilter";

const router = useRouter();
const { getCategoriesWithVisibleGroups } = useBookmarks();
const bookmarksStore = useBookmarksStore();
const categoriesStore = useCategoriesStore();
const { categoryFilter, setFilter } = useCategoryFilter();

defineProps<{
  open?: boolean;
}>();

const emit = defineEmits<{
  navigate: [];
}>();

const goTo = (path: string) => {
  router.push(path);
  emit("navigate");
};

// Mapa id → ids de todos sus descendientes (subcategorías recursivas).
const descendantMap = computed(() => {
  const childrenOf = new Map<string, string[]>();
  categoriesStore.categories.forEach((c) => {
    if (!c.padreId) return;
    const arr = childrenOf.get(c.padreId) ?? [];
    arr.push(c.id);
    childrenOf.set(c.padreId, arr);
  });

  const map = new Map<string, string[]>();
  const collect = (id: string): string[] => {
    if (map.has(id)) return map.get(id) as string[];
    const direct = childrenOf.get(id) ?? [];
    const all: string[] = [...direct];
    direct.forEach((childId) => {
      all.push(...collect(childId));
    });
    map.set(id, all);
    return all;
  };
  categoriesStore.categories.forEach((c) => collect(c.id));
  return map;
});

// Subcategorías directas (con bookmarks) por categoría padre.
const subcategoriesByParent = computed(() => {
  const result = new Map<
    string,
    { id: string; name: string; count: number; hue: number | null }[]
  >();
  const all = categoriesStore.orderedCategories;

  all.forEach((parent) => {
    const directChildren = all.filter((c) => c.padreId === parent.id);
    const list = directChildren
      .map((sub) => {
        const subTreeIds = [sub.id, ...(descendantMap.value.get(sub.id) ?? [])];
        const count = bookmarksStore.bookmarks.filter(
          (b) => b.categoryId && subTreeIds.includes(b.categoryId),
        ).length;
        return {
          id: sub.id,
          name: sub.name,
          count,
          hue: hueFromHex(sub.color),
        };
      })
      .filter((s) => s.count > 0);
    if (list.length > 0) result.set(parent.id, list);
  });

  return result;
});

const items = computed(() => {
  const all = getCategoriesWithVisibleGroups();
  const groupCountById = new Map<string, number>();
  all.forEach(({ category, groups }) =>
    groupCountById.set(category.id, groups.length),
  );

  return all
    .filter(({ category }) => !category.padreId)
    .map(({ category }) => {
      const ids = [
        category.id,
        ...(descendantMap.value.get(category.id) ?? []),
      ];
      const count = ids.reduce(
        (sum, id) => sum + (groupCountById.get(id) ?? 0),
        0,
      );
      return {
        id: category.id,
        name: category.name,
        count,
        hue: hueFromHex(category.color),
        hasSubcategories: subcategoriesByParent.value.has(category.id),
      };
    });
});

const directCountFor = (id: string): number => {
  return bookmarksStore.bookmarks.filter((b) => b.categoryId === id).length;
};

const totalCountFor = (id: string): number => {
  const ids = [id, ...(descendantMap.value.get(id) ?? [])];
  return bookmarksStore.bookmarks.filter(
    (b) => b.categoryId && ids.includes(b.categoryId),
  ).length;
};

const expandedId = ref<string | null>(null);

const toggleExpand = (id: string, event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  expandedId.value = expandedId.value === id ? null : id;
};

const activeId = ref<string | null>(null);

let observer: IntersectionObserver | null = null;
const visibleEntries = new Map<string, number>();

const recomputeActive = () => {
  let bestId: string | null = null;
  let bestRatio = -1;
  visibleEntries.forEach((ratio, id) => {
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestId = id;
    }
  });
  if (bestId) activeId.value = bestId;
};

const observe = () => {
  if (observer) observer.disconnect();
  visibleEntries.clear();

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = (entry.target as HTMLElement).dataset.categoryId;
        if (!id) return;
        if (entry.isIntersecting) {
          visibleEntries.set(id, entry.intersectionRatio);
        } else {
          visibleEntries.delete(id);
        }
      });
      recomputeActive();
    },
    {
      rootMargin: "-80px 0px -60% 0px",
      threshold: [0, 0.25, 0.5, 0.75, 1],
    },
  );

  document.querySelectorAll<HTMLElement>("[data-category-id]").forEach((el) => {
    observer!.observe(el);
  });
};

watch(
  items,
  () => {
    requestAnimationFrame(() => observe());
  },
  { flush: "post" },
);

onMounted(() => {
  requestAnimationFrame(() => observe());
});

onUnmounted(() => {
  if (observer) observer.disconnect();
});

const fastScrollTo = (target: HTMLElement) => {
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const startTop = window.scrollY;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) return;
  const duration = 180;
  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    window.scrollTo(0, startTop + distance * easeOutCubic(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const handleClick = (id: string, event: MouseEvent) => {
  const target = document.getElementById(`category-${id}`);
  if (!target) return;
  event.preventDefault();
  activeId.value = id;
  fastScrollTo(target);
  emit("navigate");
};

const applyAllInCategory = (parentId: string, parentName: string) => {
  const ids = [parentId, ...(descendantMap.value.get(parentId) ?? [])];
  setFilter(ids, parentName);
  expandedId.value = null;
  emit("navigate");
};

const applyMainOnly = (parentId: string, parentName: string) => {
  setFilter([parentId], `${parentName} · solo principal`);
  expandedId.value = null;
  emit("navigate");
};

const applySubcategory = (subId: string, subName: string) => {
  const ids = [subId, ...(descendantMap.value.get(subId) ?? [])];
  setFilter(ids, subName);
  expandedId.value = null;
  emit("navigate");
};

const handleBrandClick = (event: MouseEvent) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return;
  event.preventDefault();
  goTo("/");
};

const isFilterActiveForIds = (ids: string[]): boolean => {
  const current = categoryFilter.value;
  if (!current) return false;
  if (current.categoryIds.length !== ids.length) return false;
  const set = new Set(current.categoryIds);
  return ids.every((id) => set.has(id));
};
</script>

<template>
  <aside class="sidebar" :class="{ 'is-open': open }">
    <a
      href="/"
      class="brand"
      aria-label="Ir a inicio"
      @click="handleBrandClick"
    >
      <div class="brand-logo">
        <svg
          width="30"
          height="30"
          viewBox="0 0 1024 1024"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M710.434 806.331C711.712 806.802 712.99 807.685 714.269 807.687C773.255 807.755 832.241 807.759 891.227 807.669C892.555 807.667 893.881 806.497 895.962 805.554C935.27 801.25 965.865 766.944 965.516 724.357C964.916 651.04 965.467 577.713 965.555 504.39C965.628 443.066 966.006 381.74 965.707 320.418C965.55 288.16 950.38 264.363 921.451 250.184C913.405 246.24 903.994 245.081 894.995 241.874C893.646 241.501 892.297 240.802 890.947 240.8C832.388 240.745 773.829 240.74 715.27 240.826C713.923 240.828 712.578 241.946 710.64 243.181C710.64 253.268 710.64 263.354 710.64 273.676C713.319 273.676 715.472 273.676 717.625 273.676C774.427 273.669 831.23 273.623 888.033 273.671C915.525 273.693 936.013 294.221 935.977 321.786C935.801 456.546 935.571 591.306 935.296 726.065C935.288 729.866 934.864 733.73 934.101 737.456C929.801 758.464 910.999 774.842 890.734 774.292C888.936 774.116 887.139 773.789 885.341 773.787C861.694 773.753 838.047 773.766 814.4 773.766C781.428 773.765 748.455 773.73 715.483 773.853C713.744 773.86 712.009 775.207 710.399 776.838C710.365 786.395 710.33 795.952 710.434 806.331ZM130.391 774.907C106.229 771.923 88.2348 751.572 88.2255 726.892C88.1742 591.913 88.1805 456.933 88.1931 321.954C88.1934 319.131 88.2492 316.264 88.7176 313.492C92.7182 289.813 112.015 273.704 136.534 273.676C194.358 273.609 252.183 273.627 310.007 273.611C311.626 273.611 313.245 273.611 315.208 273.611C315.208 263.038 315.208 252.915 315.016 241.998C313.359 241.585 311.707 240.835 310.046 240.815C300.549 240.699 291.051 240.756 281.553 240.756C232.23 240.756 182.908 240.735 133.585 240.841C131.794 240.845 130.006 242.099 127.49 243.103C94.6967 248.065 72.4732 265.94 61.6726 297.434C57.7212 308.957 58.1931 321.035 58.1999 333.046C58.2743 464.296 58.2499 595.546 58.3019 726.796C58.3107 749.047 66.364 768.036 82.2505 783.611C95.5909 796.69 111.817 803.717 130.475 806.723C131.675 807.065 132.876 807.706 134.076 807.707C193.16 807.756 252.244 807.762 311.328 807.666C312.627 807.664 313.924 806.428 315.261 804.83C315.26 795.084 315.26 785.339 314.973 774.851C313.288 774.491 311.602 773.817 309.916 773.815C252.072 773.759 194.228 773.758 136.384 773.806C134.661 773.808 132.938 774.433 130.391 774.907ZM652.993 148.76C650.055 148.46 647.116 148.161 643.263 148.056C596.431 148.051 549.598 148.061 502.765 148.038C462.939 148.018 423.112 147.959 382.947 147.387C382.042 147.728 381.138 148.069 379.472 148.762C372.838 151.292 365.567 152.82 359.694 156.548C344.566 166.149 337.042 180.429 337.04 198.522C337.018 411.678 336.981 624.834 336.952 837.99C336.952 844.321 336.675 850.676 337.11 856.98C337.979 869.565 349.801 878.874 361.945 875.865C366.976 874.619 372.07 871.547 375.935 867.998C416.19 831.028 456.216 793.808 496.271 756.62C508.602 745.171 517.383 745.172 529.589 756.482C570.295 794.194 611.091 831.809 651.789 869.531C659.284 876.479 667.741 878.674 677.045 874.495C686.202 870.383 689.964 862.493 689.966 852.647C690.027 634.158 690.094 415.669 690.134 197.18C690.134 194.525 690.059 191.816 689.548 189.225C685.483 168.643 673.013 155.666 652.993 148.76Z"
            fill="black"
          />
          <path
            d="M758.724 327.229C771.051 326.985 783.386 327.159 795.718 327.147C819.382 327.163 842.045 327.142 864.708 327.199C882.377 327.243 891.533 336.418 891.541 354.047L891.543 356.946C891.557 388.975 891.572 421.004 891.506 453.033C891.472 469.936 881.636 479.558 864.712 479.553C829.55 479.544 794.388 479.566 759.227 479.57C743.414 479.572 733.38 469.491 733.381 453.623C733.382 420.128 733.367 386.633 733.39 353.137C733.401 337.214 742.731 327.545 758.724 327.229Z"
            fill="#B76BCD"
          />
          <path
            d="M800.581 628.458C800.948 656.409 800.569 684.37 800.487 712.328C797.863 723.699 791.402 729.133 780.628 729.335C771.476 729.506 762.313 729.524 753.163 729.295C741.102 728.992 733.439 720.987 733.404 708.832C733.33 683.529 733.285 658.226 733.342 632.924C733.375 618.091 740.731 610.818 755.437 610.795C764.093 610.781 772.749 610.783 781.404 610.825C791.994 610.877 800.442 617.881 800.581 628.458Z"
            fill="#E0615C"
          />
          <path
            d="M822.438 708.744C822.334 698.916 822.445 689.085 822.461 679.256C822.446 637.438 822.422 596.621 822.464 555.803C822.475 544.598 830.557 536.147 841.873 535.839C852.195 535.558 862.537 535.548 872.857 535.856C883.817 536.184 891.375 544.855 891.379 556.61C891.39 593.762 891.366 630.915 891.347 668.067C891.341 681.396 891.376 694.724 891.274 708.052C891.17 721.548 883.166 729.469 869.794 729.481C860.964 729.489 852.134 729.512 843.305 729.458C831.004 729.383 822.569 721.064 822.438 708.744Z"
            fill="#00A6BB"
          />
          <path
            d="M277.201 663.637C241.373 663.742 205.546 663.703 169.718 663.72C162.886 663.712 157.052 663.797 151.221 663.677C139.623 663.44 130.73 654.651 130.668 643.495C130.604 632.091 139.645 622.789 151.25 622.762C193.243 622.664 235.236 622.647 277.228 622.714C288.648 622.732 297.314 631.755 297.342 643.194C297.37 654.555 288.643 663.603 277.201 663.637Z"
            fill="#E0615C"
          />
          <path
            d="M276.147 362.955C287.4 362.926 300.103 372.236 296.928 388.484C292.823 399.47 286.28 404.002 275.393 403.999C234.236 403.988 193.08 403.981 151.923 403.955C139.914 403.948 130.522 394.866 130.629 383.429C130.733 372.214 139.964 363.082 151.678 363.055C193.167 362.961 234.658 363.061 276.147 362.955Z"
            fill="#00A6BB"
          />
          <path
            d="M153.175 531.579C144.97 531.58 138.189 528.83 133.66 521.637C126.072 505.966 135.513 490.693 152.161 490.661C193.322 490.58 234.483 490.57 275.644 490.587C288.28 490.592 297.463 499.295 297.437 511.035C297.411 522.959 288.376 531.568 275.658 531.578C234.83 531.613 194.002 531.578 153.175 531.579Z"
            fill="#B76BCD"
          />
        </svg>
      </div>
      <div class="brand-name">MyBookmarks</div>
    </a>

    <div class="quick-actions">
      <button class="quick-btn primary" @click="goTo('/edit')">
        + Nuevo bookmark
      </button>
      <button class="quick-btn" @click="goTo('/categories')">
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
              :aria-label="
                expandedId === item.id
                  ? 'Cerrar subcategorías'
                  : 'Abrir subcategorías'
              "
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
              :class="{
                active: isFilterActiveForIds([
                  item.id,
                  ...(descendantMap.get(item.id) ?? []),
                ]),
              }"
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
                active: isFilterActiveForIds([
                  sub.id,
                  ...(descendantMap.get(sub.id) ?? []),
                ]),
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

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    height: 100dvh;
    width: 280px;
    max-width: 86vw;
    padding-top: 56px;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 220ms ease;
    box-shadow: 4px 0 24px rgba(28, 26, 20, 0.12);
  }
  .sidebar.is-open {
    transform: translateX(0);
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 4px 6px;
  margin-bottom: 28px;
  text-decoration: none;
  border-radius: 8px;
  transition: background 120ms ease;
}
.brand:hover {
  background: var(--bg-soft, #f3f1ec);
}
.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
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
  transition:
    background 120ms ease,
    color 120ms ease;
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
  transition:
    background 120ms ease,
    color 120ms ease;
}
.nav-item:hover {
  background: var(--bg-soft, #f3f1ec);
}
.nav-item.active {
  background: var(--bg-soft, #f1efe9);
}
.nav-item.active::before {
  content: "";
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
.nav-row.no-accent .dot {
  background: transparent;
}
.nav-row.no-accent .nav-item.active::before {
  background: transparent;
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
  transition:
    background 120ms ease,
    color 120ms ease,
    transform 160ms ease;
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
  transition:
    background 120ms ease,
    color 120ms ease;
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
.sub-item.no-accent .sub-dot {
  background: transparent;
}
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
