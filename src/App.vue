<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'

const route = useRoute()
const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
  isSidebarOpen.value = false
}

provide('toggleSidebar', toggleSidebar)

const isHome = computed(() => route.name === 'home')

watch(() => route.fullPath, () => {
  isSidebarOpen.value = false
})
</script>

<template>
  <div class="app-shell" :class="{ 'is-home': isHome }">
    <button
      v-if="!isHome"
      type="button"
      class="menu-btn"
      :aria-expanded="isSidebarOpen"
      aria-label="Abrir menú"
      @click="toggleSidebar"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <div
      class="sidebar-backdrop"
      :class="{ visible: isSidebarOpen }"
      @click="closeSidebar"
      aria-hidden="true"
    ></div>

    <Sidebar :open="isSidebarOpen" @navigate="closeSidebar" />

    <main class="main">
      <div class="main-inner">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg, #faf9f7);
}
.main {
  flex: 1;
  min-width: 0;
}
.main-inner {
  max-width: 1180px;
  padding: 22px 28px 64px;
}

.menu-btn {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 60;
  width: 40px;
  height: 40px;
  place-items: center;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 10px;
  color: var(--fg, #1c1a14);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(28, 26, 20, 0.06);
  transition: background 120ms ease;
}
.menu-btn:hover {
  background: var(--bg-soft, #f3f1ec);
}

.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(28, 26, 20, 0.4);
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

@media (max-width: 900px) {
  .main-inner {
    padding: 64px 20px 64px;
  }
  .app-shell.is-home .main-inner {
    padding: 0 20px 64px;
  }

  .menu-btn {
    display: grid;
  }

  .sidebar-backdrop {
    display: block;
  }
  .sidebar-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (max-width: 480px) {
  .main-inner {
    padding: 60px 14px 48px;
  }
  .app-shell.is-home .main-inner {
    padding: 0 14px 48px;
  }
}
</style>
