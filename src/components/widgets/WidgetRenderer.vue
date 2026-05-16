<script setup lang="ts">
import { computed } from 'vue'
import type { Widget } from '@/types'
import { getWidgetType } from '@/widgets/registry'

const props = defineProps<{
  widgets?: Widget[] | null
}>()

const ordered = computed(() => {
  const list = props.widgets ?? []
  return [...list].sort((a, b) => a.order - b.order)
})
</script>

<template>
  <div v-if="ordered.length > 0" class="wr">
    <template v-for="w in ordered" :key="w.id">
      <component
        v-if="getWidgetType(w.type)"
        :is="getWidgetType(w.type)!.RenderComponent"
        :widget="w"
      />
    </template>
  </div>
</template>

<style scoped>
.wr {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}
</style>
