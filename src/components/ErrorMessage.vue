<script setup lang="ts">
defineProps<{
  message: string
}>()

const emit = defineEmits<{
  'retry': []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <svg class="h-16 w-16 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
    <h3 class="mt-4 text-lg font-medium text-gray-900">Error al cargar datos</h3>
    <p class="mt-2 text-sm text-gray-500">{{ message }}</p>
    <button
      @click="emit('retry')"
      class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Reintentar
    </button>
  </div>
</template>
