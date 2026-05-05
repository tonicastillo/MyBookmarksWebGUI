<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  modelValue: string | null | undefined
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { disabled: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const HUES = [0, 45, 90, 135, 180, 225, 270, 315]
const SATURATIONS = [75, 55, 35]
const LIGHTNESS = 52

const hslToHex = (h: number, s: number, l: number): string => {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const swatches = computed(() =>
  SATURATIONS.flatMap((s) => HUES.map((h) => hslToHex(h, s, LIGHTNESS)))
)

const open = ref(false)
const wrapper = ref<HTMLElement | null>(null)

const currentColor = computed(() => props.modelValue ?? null)

const isSelected = (hex: string): boolean =>
  !!currentColor.value && currentColor.value.toLowerCase() === hex.toLowerCase()

const toggle = () => {
  if (props.disabled) return
  open.value = !open.value
}

const close = () => { open.value = false }

const select = (hex: string | null) => {
  emit('update:modelValue', hex)
  close()
}

const onDocumentClick = (event: MouseEvent) => {
  if (!open.value) return
  if (wrapper.value && !wrapper.value.contains(event.target as Node)) close()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="wrapper" class="picker">
    <button
      type="button"
      class="trigger"
      :class="{ empty: !currentColor }"
      :style="currentColor ? { background: currentColor } : undefined"
      :disabled="disabled"
      :aria-label="currentColor ? `Color ${currentColor}` : 'Sin color'"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <span v-if="!currentColor" class="empty-mark">⊘</span>
    </button>

    <div v-if="open" class="popover" role="dialog">
      <div class="grid">
        <button
          v-for="hex in swatches"
          :key="hex"
          type="button"
          class="swatch"
          :class="{ selected: isSelected(hex) }"
          :style="{ background: hex }"
          :aria-label="hex"
          @click.stop="select(hex)"
        />
      </div>
      <button
        type="button"
        class="clear"
        :class="{ selected: !currentColor }"
        @click.stop="select(null)"
      >
        <span class="clear-icon">⊘</span>
        <span>Sin color</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  display: inline-block;
}
.trigger {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.2));
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, border-color 0.1s;
}
.trigger:hover:not(:disabled) {
  transform: scale(1.08);
  border-color: var(--fg-mid, #4a463c);
}
.trigger:disabled { cursor: not-allowed; opacity: 0.5; }
.trigger.empty {
  background: var(--bg-elev, #ffffff);
}
.empty-mark {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  line-height: 1;
}

.popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 18px);
  gap: 6px;
}
.swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: transform 0.08s;
}
.swatch:hover { transform: scale(1.15); }
.swatch.selected {
  outline: 1.5px solid var(--fg, #1c1a14);
  outline-offset: 1.5px;
}

.clear {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  background: transparent;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 6px;
  cursor: pointer;
}
.clear:hover { color: var(--fg, #1c1a14); border-color: var(--fg-mid, #4a463c); }
.clear.selected { color: var(--fg, #1c1a14); border-color: var(--fg-mid, #4a463c); }
.clear-icon { font-size: 13px; line-height: 1; }
</style>
