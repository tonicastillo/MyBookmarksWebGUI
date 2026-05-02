<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const clearSearch = () => {
  emit('update:modelValue', '')
  inputRef.value?.focus()
}

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
}

watch(() => props.modelValue, (newValue) => {
  if (inputRef.value && inputRef.value.value !== newValue) {
    inputRef.value.value = newValue
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="search">
    <span class="search-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="9" r="6" />
        <path d="m17 17-3.5-3.5" />
      </svg>
    </span>
    <input
      ref="inputRef"
      type="text"
      :value="modelValue"
      @input="handleInput"
      placeholder="Buscar bookmarks — título, URL, etiquetas…"
    />
    <div class="search-meta">
      <button
        v-if="modelValue"
        @click="clearSearch"
        class="clear"
        aria-label="Limpiar búsqueda"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
      <template v-else>
        <kbd class="kbd">⌘</kbd>
        <kbd class="kbd">K</kbd>
      </template>
    </div>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 12px 0 14px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.1));
  border-radius: 12px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.search:focus-within {
  border-color: var(--border-strong, rgba(28, 26, 20, 0.22));
  box-shadow: 0 0 0 3px rgba(28, 26, 20, 0.04);
}
.search-icon {
  display: grid;
  place-items: center;
  color: var(--fg-faint, #a8a294);
  flex-shrink: 0;
}
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--fg, #1c1a14);
}
.search input::placeholder {
  color: var(--fg-faint, #a8a294);
}
.search-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.kbd {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 11px;
  font-family: inherit;
  color: var(--fg-soft, #7a7468);
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 5px;
  line-height: 1;
}
.clear {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
}
.clear:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}
</style>
