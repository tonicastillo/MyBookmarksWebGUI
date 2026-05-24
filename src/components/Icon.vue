<script setup lang="ts">
import { ref, watch } from 'vue'
import { getIconData, type IconData } from '@/lib/icons'

interface Props {
  name: string | null | undefined
  size?: number | string
  title?: string
}

const props = withDefaults(defineProps<Props>(), { size: 16 })

const data = ref<IconData | null>(null)

const load = async (name: string | null | undefined): Promise<void> => {
  if (!name) {
    data.value = null
    return
  }
  const result = await getIconData(name)
  data.value = result
}

watch(() => props.name, load, { immediate: true })
</script>

<template>
  <svg
    v-if="data"
    :width="size"
    :height="size"
    :viewBox="`0 0 ${data.width} ${data.height}`"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="title || undefined"
    :aria-hidden="title ? undefined : true"
    v-html="data.body"
  />
</template>
