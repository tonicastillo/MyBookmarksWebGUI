<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
    })
  ],
  editorProps: {
    attributes: { class: 'rte-content' }
  },
  onUpdate: ({ editor: e }) => {
    const html = e.getHTML()
    const normalized = html === '<p></p>' ? '' : html
    emit('update:modelValue', normalized)
  }
})

watch(
  () => props.modelValue,
  (next) => {
    const current = editor.value?.getHTML() ?? ''
    const incoming = next || ''
    const normCurrent = current === '<p></p>' ? '' : current
    if (incoming !== normCurrent) {
      editor.value?.commands.setContent(incoming || '', false)
    }
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const setLink = () => {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href as string | undefined
  const url = window.prompt('URL del enlace (vacío para quitar):', prev ?? '')
  if (url === null) return
  const trimmed = url.trim()
  if (trimmed === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: trimmed })
    .run()
}

const isActive = (name: string, attrs?: Record<string, unknown>): boolean =>
  editor.value ? editor.value.isActive(name, attrs as never) : false
</script>

<template>
  <div class="rte">
    <div v-if="editor" class="rte-toolbar">
      <button
        type="button"
        class="rte-btn"
        :class="{ active: isActive('bold') }"
        title="Negrita"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="rte-btn"
        :class="{ active: isActive('italic') }"
        title="Itálica"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <em>I</em>
      </button>
      <span class="rte-sep" aria-hidden="true"></span>
      <button
        type="button"
        class="rte-btn"
        :class="{ active: isActive('bulletList') }"
        title="Lista con viñetas"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="rte-btn"
        :class="{ active: isActive('orderedList') }"
        title="Lista numerada"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4" />
          <path d="M4 10h2" />
          <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </svg>
      </button>
      <span class="rte-sep" aria-hidden="true"></span>
      <button
        type="button"
        class="rte-btn"
        :class="{ active: isActive('link') }"
        title="Enlace"
        @click="setLink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
    </div>
    <EditorContent :editor="editor" class="rte-area" />
    <p v-if="placeholder && !modelValue" class="rte-placeholder">{{ placeholder }}</p>
  </div>
</template>

<style scoped>
.rte {
  position: relative;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 8px;
  background: var(--bg-elev, #ffffff);
  display: flex;
  flex-direction: column;
}
.rte:focus-within {
  border-color: var(--fg-mid, #4a463c);
}
.rte-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  background: var(--bg-soft, #f3f1ec);
  border-radius: 8px 8px 0 0;
}
.rte-btn {
  display: grid;
  place-items: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--fg-mid, #4a463c);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.rte-btn:hover {
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
}
.rte-btn.active {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
}
.rte-sep {
  width: 1px;
  height: 16px;
  background: var(--border, rgba(28, 26, 20, 0.12));
  margin: 0 2px;
}
.rte-area {
  padding: 10px 12px;
  min-height: 120px;
  font-size: 13.5px;
  color: var(--fg, #1c1a14);
}
.rte-placeholder {
  position: absolute;
  top: 44px;
  left: 12px;
  margin: 0;
  font-size: 13.5px;
  color: var(--fg-faint, #a8a294);
  pointer-events: none;
}
</style>

<style>
.rte-content {
  outline: none;
  min-height: 100px;
}
.rte-content p {
  margin: 0 0 8px;
}
.rte-content p:last-child {
  margin-bottom: 0;
}
.rte-content ul,
.rte-content ol {
  margin: 0 0 8px;
  padding-left: 22px;
}
.rte-content ul ul,
.rte-content ol ol,
.rte-content ul ol,
.rte-content ol ul {
  margin-bottom: 0;
}
.rte-content li {
  margin: 2px 0;
}
.rte-content a {
  color: oklch(0.55 0.18 260);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.rte-content strong {
  font-weight: 700;
}
.rte-content em {
  font-style: italic;
}
</style>
