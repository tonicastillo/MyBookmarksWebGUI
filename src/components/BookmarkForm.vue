<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Bookmark } from '@/types'
import { useCategoriesStore } from '@/stores/categories'
import { useBookmarksStore } from '@/stores/bookmarks'
import type { BookmarkInput } from '@/api/notion'

const props = defineProps<{
  bookmark?: Bookmark
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { input: BookmarkInput; imageFile: File | null; removeImage: boolean }]
  cancel: []
  delete: []
}>()

const categoriesStore = useCategoriesStore()
const bookmarksStore = useBookmarksStore()

const name = ref(props.bookmark?.name ?? '')
const url = ref(props.bookmark?.url ?? '')
const alternateUrl = ref(props.bookmark?.alternateUrl ?? '')
const subtitle = ref(props.bookmark?.subtitle ?? '')
const categoryId = ref(props.bookmark?.categoryId ?? '')
const parentBookmarkId = ref(props.bookmark?.parentBookmarkId ?? '')
const visibleAtStart = ref(props.bookmark?.visibleAtStart ?? false)
const status = ref<Bookmark['status']>(props.bookmark?.status ?? 'Not started')
const valoration = ref(props.bookmark?.valoration ?? '')
const colorHue = ref<number | ''>(props.bookmark?.colorHue ?? '')
const searchPlaceholder = ref(props.bookmark?.searchPlaceholder ?? '')
const searchUrlTemplate = ref(props.bookmark?.searchUrlTemplate ?? '')
const tags = ref<string[]>([...(props.bookmark?.tags ?? [])])
const tagInput = ref('')

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const removeImage = ref(false)

const currentImageUrl = computed(() => {
  if (removeImage.value) return null
  if (imagePreview.value) return imagePreview.value
  return props.bookmark?.imageUrl ?? null
})

const sortedCategories = computed(() => categoriesStore.orderedCategories)

const possibleParents = computed(() => {
  return bookmarksStore.bookmarks
    .filter(b => b.id !== props.bookmark?.id && !b.parentBookmarkId)
    .sort((a, b) => a.name.localeCompare(b.name))
})

const tagSuggestions = computed(() => {
  const q = tagInput.value.toLowerCase().trim()
  if (!q) return []
  return bookmarksStore.allTags
    .filter(t => t.toLowerCase().includes(q) && !tags.value.includes(t))
    .slice(0, 8)
})

const handleImageChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageFile.value = file
  removeImage.value = false
  const reader = new FileReader()
  reader.onload = () => {
    imagePreview.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

const handleRemoveImage = () => {
  imageFile.value = null
  imagePreview.value = null
  removeImage.value = true
}

const addTag = (tag: string) => {
  const trimmed = tag.trim()
  if (!trimmed) return
  if (!tags.value.includes(trimmed)) tags.value.push(trimmed)
  tagInput.value = ''
}

const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addTag(tagInput.value)
  } else if (event.key === 'Backspace' && !tagInput.value && tags.value.length > 0) {
    tags.value.pop()
  }
}

const removeTag = (tag: string) => {
  tags.value = tags.value.filter(t => t !== tag)
}

const handleSubmit = (event: Event) => {
  event.preventDefault()
  const input: BookmarkInput = {
    name: name.value.trim(),
    url: url.value.trim() || null,
    alternateUrl: alternateUrl.value.trim() || null,
    subtitle: subtitle.value.trim() || null,
    categoryId: categoryId.value || null,
    parentBookmarkId: parentBookmarkId.value || null,
    visibleAtStart: visibleAtStart.value,
    status: status.value,
    valoration: valoration.value || null,
    colorHue: colorHue.value === '' ? null : Number(colorHue.value),
    searchPlaceholder: searchPlaceholder.value.trim() || null,
    searchUrlTemplate: searchUrlTemplate.value.trim() || null,
    tags: tags.value
  }
  emit('submit', { input, imageFile: imageFile.value, removeImage: removeImage.value })
}

watch(
  () => props.bookmark,
  (b) => {
    if (!b) return
    name.value = b.name
    url.value = b.url ?? ''
    alternateUrl.value = b.alternateUrl ?? ''
    subtitle.value = b.subtitle ?? ''
    categoryId.value = b.categoryId ?? ''
    parentBookmarkId.value = b.parentBookmarkId ?? ''
    visibleAtStart.value = b.visibleAtStart
    status.value = b.status
    valoration.value = b.valoration ?? ''
    colorHue.value = b.colorHue ?? ''
    searchPlaceholder.value = b.searchPlaceholder ?? ''
    searchUrlTemplate.value = b.searchUrlTemplate ?? ''
    tags.value = [...b.tags]
  }
)
</script>

<template>
  <form class="bm-form" @submit="handleSubmit">
    <div class="form-grid">
      <div class="image-block">
        <div class="image-preview">
          <img v-if="currentImageUrl" :src="currentImageUrl" :alt="name" />
          <span v-else class="image-placeholder">Sin imagen</span>
        </div>
        <div class="image-actions">
          <label class="btn btn-secondary">
            Subir imagen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif"
              hidden
              @change="handleImageChange"
            />
          </label>
          <button
            v-if="currentImageUrl"
            type="button"
            class="btn btn-ghost"
            @click="handleRemoveImage"
          >
            Quitar
          </button>
        </div>
      </div>

      <div class="fields">
        <label class="field">
          <span class="label">Nombre</span>
          <input v-model="name" type="text" required />
        </label>

        <label class="field">
          <span class="label">URL</span>
          <input v-model="url" type="url" placeholder="https://…" />
        </label>

        <label class="field">
          <span class="label">URL alternativa</span>
          <input v-model="alternateUrl" type="url" />
        </label>

        <label class="field">
          <span class="label">Subtítulo</span>
          <input v-model="subtitle" type="text" />
        </label>

        <div class="row">
          <label class="field">
            <span class="label">Categoría</span>
            <select v-model="categoryId">
              <option value="">— Sin categoría —</option>
              <option v-for="c in sortedCategories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="label">Bookmark padre (mega card)</span>
            <select v-model="parentBookmarkId">
              <option value="">— Ninguno —</option>
              <option v-for="b in possibleParents" :key="b.id" :value="b.id">
                {{ b.name }}
              </option>
            </select>
          </label>
        </div>

        <div class="row">
          <label class="field">
            <span class="label">Estado</span>
            <select v-model="status">
              <option value="Not started">Not started</option>
              <option value="In progress">In progress</option>
              <option value="Done">Done</option>
            </select>
          </label>

          <label class="field">
            <span class="label">Valoración</span>
            <select v-model="valoration">
              <option value="">— Sin valorar —</option>
              <option value="⭐">⭐</option>
              <option value="⭐⭐">⭐⭐</option>
              <option value="⭐⭐⭐">⭐⭐⭐</option>
              <option value="⭐⭐⭐⭐">⭐⭐⭐⭐</option>
              <option value="⭐⭐⭐⭐⭐">⭐⭐⭐⭐⭐</option>
            </select>
          </label>

          <label class="field">
            <span class="label">Color (0–360)</span>
            <input v-model="colorHue" type="number" min="0" max="360" placeholder="auto" />
          </label>
        </div>

        <label class="field toggle">
          <input v-model="visibleAtStart" type="checkbox" />
          <span>Visible en la home</span>
        </label>

        <div class="field">
          <span class="label">Tags</span>
          <div class="tags-input">
            <button
              v-for="tag in tags"
              :key="tag"
              type="button"
              class="tag-chip"
              @click="removeTag(tag)"
            >
              {{ tag }} ×
            </button>
            <input
              v-model="tagInput"
              type="text"
              :placeholder="tags.length ? '' : 'Añadir tag…'"
              @keydown="handleTagKeydown"
            />
          </div>
          <div v-if="tagSuggestions.length > 0" class="tag-suggestions">
            <button
              v-for="t in tagSuggestions"
              :key="t"
              type="button"
              class="tag-suggestion"
              @click="addTag(t)"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <details class="advanced">
          <summary>Búsqueda interna (opcional)</summary>
          <div class="row">
            <label class="field">
              <span class="label">Placeholder</span>
              <input v-model="searchPlaceholder" type="text" />
            </label>
            <label class="field">
              <span class="label">URL plantilla (con {q})</span>
              <input
                v-model="searchUrlTemplate"
                type="url"
                placeholder="https://…/search?q={q}"
              />
            </label>
          </div>
        </details>
      </div>
    </div>

    <div class="actions">
      <button
        v-if="bookmark"
        type="button"
        class="btn btn-danger"
        :disabled="submitting"
        @click="emit('delete')"
      >
        Borrar
      </button>
      <div class="actions-right">
        <button type="button" class="btn btn-ghost" @click="emit('cancel')">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Guardando…' : (bookmark ? 'Guardar' : 'Crear') }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.bm-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.form-grid {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 28px;
  align-items: start;
}
@media (max-width: 720px) {
  .form-grid { grid-template-columns: 1fr; }
}

.image-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.image-preview {
  width: 220px;
  height: 220px;
  border-radius: 14px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  display: grid;
  place-items: center;
  overflow: hidden;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-placeholder {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
}
.image-actions {
  display: flex;
  gap: 8px;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 540px) {
  .row { grid-template-columns: 1fr; }
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fg-faint, #a8a294);
}
.field input,
.field select {
  height: 34px;
  padding: 0 10px;
  font: inherit;
  font-size: 13.5px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 8px;
  color: var(--fg, #1c1a14);
  outline: none;
  transition: border-color 120ms ease;
}
.field input:focus,
.field select:focus {
  border-color: var(--fg-mid, #4a463c);
}
.field.toggle {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.field.toggle span {
  font-size: 13.5px;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 8px;
  min-height: 34px;
}
.tags-input input {
  flex: 1;
  min-width: 120px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  outline: none;
  padding: 4px 6px;
}
.tag-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg-mid, #4a463c);
  border: 0;
  cursor: pointer;
}
.tag-chip:hover {
  background: var(--bg-softer, #ecebe5);
}
.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.tag-suggestion {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--fg-soft, #7a7468);
  border: 0.5px dashed var(--border, rgba(28, 26, 20, 0.16));
  cursor: pointer;
}
.tag-suggestion:hover {
  background: var(--bg-soft, #f3f1ec);
  color: var(--fg, #1c1a14);
}

.advanced {
  margin-top: 4px;
}
.advanced summary {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
  cursor: pointer;
  padding: 6px 0;
  user-select: none;
}
.advanced[open] summary {
  margin-bottom: 8px;
  color: var(--fg-mid, #4a463c);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
}
.actions-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border: 0;
}
.btn-primary:hover:not(:disabled) {
  background: var(--fg-mid, #4a463c);
}
.btn-secondary {
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-soft, #f3f1ec);
}
.btn-ghost {
  background: transparent;
  color: var(--fg-mid, #4a463c);
  border: 0;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-soft, #f3f1ec);
}
.btn-danger {
  background: transparent;
  color: #b85248;
  border: 0.5px solid rgba(184, 82, 72, 0.3);
}
.btn-danger:hover:not(:disabled) {
  background: rgba(184, 82, 72, 0.08);
}
</style>
