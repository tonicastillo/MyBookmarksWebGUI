<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'
</script>

<template>
  <div class="app-shell">
    <Sidebar />
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
@media (max-width: 768px) {
  .main-inner {
    padding: 16px;
  }
}
</style>
