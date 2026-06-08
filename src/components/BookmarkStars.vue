<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  valoration?: number | null
}>()

const count = computed(() => {
  const v = props.valoration ?? 0
  if (!Number.isFinite(v) || v < 1) return 0
  return Math.min(3, Math.round(v))
})
</script>

<template>
  <div
    v-if="count > 0"
    class="stars"
    :aria-label="`Valoración: ${count} de 3`"
    role="img"
  >
    <svg
      v-for="i in count"
      :key="i"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
      />
    </svg>
  </div>
</template>

<style scoped>
.stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: #f5a623;
  line-height: 1;
}
</style>
