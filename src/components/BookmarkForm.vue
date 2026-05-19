<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import type { Bookmark } from "@/types";
import { useCategoriesStore } from "@/stores/categories";
import { useBookmarksStore } from "@/stores/bookmarks";
import type { BookmarkInput } from "@/api/notion";
import CategoryColorPicker from "@/components/CategoryColorPicker.vue";
import { buildImageStyle } from "@/composables/useImageStyle";
import {
  useImageClipboard,
  type ImageClipboardData,
} from "@/composables/useImageClipboard";
import {
  fetchImageAsDataUrl,
  dataUrlToFile,
} from "@/composables/useBookmarkImageTransfer";
import type { BookmarkDuplicateData } from "@/composables/useBookmarkDuplicate";

const props = defineProps<{
  bookmark?: Bookmark;
  submitting?: boolean;
  defaultCategoryId?: string;
  defaultParentBookmarkId?: string;
  prefill?: BookmarkDuplicateData;
}>();

const emit = defineEmits<{
  submit: [
    payload: {
      input: BookmarkInput;
      imageFile: File | null;
      removeImage: boolean;
    },
  ];
  cancel: [];
  delete: [];
}>();

const categoriesStore = useCategoriesStore();
const bookmarksStore = useBookmarksStore();

const p = props.prefill;
const name = ref(props.bookmark?.name ?? p?.name ?? "");
const url = ref(props.bookmark?.url ?? p?.url ?? "");
const subtitle = ref(props.bookmark?.subtitle ?? p?.subtitle ?? "");
const categoryId = ref(
  props.bookmark?.categoryId ?? p?.categoryId ?? props.defaultCategoryId ?? "",
);
const parentBookmarkId = ref(
  props.bookmark?.parentBookmarkId ??
    p?.parentBookmarkId ??
    props.defaultParentBookmarkId ??
    "",
);
const visibleAtStart = ref(
  props.bookmark?.visibleAtStart ?? p?.visibleAtStart ?? true,
);
const isMegaCard = ref(props.bookmark?.isMegaCard ?? p?.isMegaCard ?? false);
const color = ref<string | null>(props.bookmark?.color ?? p?.color ?? null);
const searchPlaceholder = ref(
  props.bookmark?.searchPlaceholder ?? p?.searchPlaceholder ?? "",
);
const searchUrlTemplate = ref(
  props.bookmark?.searchUrlTemplate ?? p?.searchUrlTemplate ?? "",
);
const tags = ref<string[]>([...(props.bookmark?.tags ?? p?.tags ?? [])]);
const tagInput = ref("");

const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const removeImage = ref(false);

const imageScale = ref<number>(
  props.bookmark?.imageScale ?? p?.imageScale ?? 1,
);
const imageBgColor = ref<string | null>(
  props.bookmark?.imageBgColor ?? p?.imageBgColor ?? null,
);
const imageBgColor2 = ref<string | null>(
  props.bookmark?.imageBgColor2 ?? p?.imageBgColor2 ?? null,
);
const useGradient = ref<boolean>(
  Boolean(props.bookmark?.imageBgColor2 ?? p?.imageBgColor2),
);

if (!props.bookmark && p?.imageDataUrl && p.imageMimeType) {
  const file = dataUrlToFile(p.imageDataUrl, p.imageMimeType, "duplicate");
  if (file) {
    imageFile.value = file;
    imagePreview.value = p.imageDataUrl;
    removeImage.value = false;
  }
}

const currentImageUrl = computed(() => {
  if (removeImage.value) return null;
  if (imagePreview.value) return imagePreview.value;
  return props.bookmark?.imageUrl ?? null;
});

const previewStyle = computed(() =>
  buildImageStyle({
    imageScale: imageScale.value,
    imageBgColor: imageBgColor.value,
    imageBgColor2: useGradient.value ? imageBgColor2.value : null,
  }),
);

const dashboardIconsUrl = computed(() => {
  const q = name.value.trim();
  if (!q) return "https://dashboardicons.com/";
  return `https://dashboardicons.com/icons?q=${encodeURIComponent(q)}`;
});

const colorToHex = (value: string | null): string => {
  if (!value) return "#cccccc";
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return (
      "#" +
      trimmed
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  return "#cccccc";
};

const bgColor1Hex = computed({
  get: () => colorToHex(imageBgColor.value),
  set: (v: string) => {
    imageBgColor.value = v;
  },
});
const bgColor2Hex = computed({
  get: () => colorToHex(imageBgColor2.value),
  set: (v: string) => {
    imageBgColor2.value = v;
  },
});

const handleClearBg = () => {
  imageBgColor.value = null;
  imageBgColor2.value = null;
  useGradient.value = false;
};

const toggleGradient = () => {
  useGradient.value = !useGradient.value;
  if (useGradient.value && !imageBgColor2.value) {
    imageBgColor2.value = imageBgColor.value ?? "#ffffff";
  }
};

const sortedCategories = computed(() => categoriesStore.orderedCategories);

const possibleParents = computed(() => {
  return bookmarksStore.bookmarks
    .filter((b) => b.id !== props.bookmark?.id && b.isMegaCard)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const tagSuggestions = computed(() => {
  const q = tagInput.value.toLowerCase().trim();
  if (!q) return [];
  return bookmarksStore.allTags
    .filter((t) => t.toLowerCase().includes(q) && !tags.value.includes(t))
    .slice(0, 8);
});

const handleImageChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  imageFile.value = file;
  removeImage.value = false;
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.value = reader.result as string;
  };
  reader.readAsDataURL(file);
  if (file.type === "image/svg+xml") {
    loadSvgFromFile(file);
  } else {
    svgContent.value = null;
    svgModified.value = false;
    selectedSvgColors.value = new Set();
  }
};

const handleRemoveImage = () => {
  imageFile.value = null;
  imagePreview.value = null;
  removeImage.value = true;
  svgContent.value = null;
  svgModified.value = false;
  selectedSvgColors.value = new Set();
};

const { clipboard, hasClipboard, setClipboard } = useImageClipboard();

const svgContent = ref<string | null>(null);
const svgModified = ref(false);
const selectedSvgColors = ref<Set<string>>(new Set());

const SKIP_COLOR = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
  "",
]);

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  teal: "#008080",
  navy: "#000080",
  fuchsia: "#ff00ff",
  purple: "#800080",
  orange: "#ffa500",
};

const normalizeColor = (raw: string): string => {
  const v = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
  const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgb) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  return v;
};

const HEX_RGB_RE =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+(?:[\s,/]+[\d.%]+)?\s*\)/g;
const NAMED_PROP_RE =
  /(fill|stroke|stop-color|flood-color|lighting-color|color)(\s*[:=]\s*)(["']?)([a-zA-Z]+)\3/gi;

const parseColorsFromSvg = (svgText: string): string[] => {
  const colors = new Set<string>();
  const hexMatches = svgText.match(HEX_RGB_RE);
  if (hexMatches) hexMatches.forEach((m) => colors.add(normalizeColor(m)));
  for (const m of svgText.matchAll(NAMED_PROP_RE)) {
    const name = m[4].toLowerCase();
    if (SKIP_COLOR.has(name)) continue;
    if (NAMED_COLORS[name]) colors.add(NAMED_COLORS[name]);
  }
  return [...colors];
};

const replaceColorsInSvg = (
  svgText: string,
  from: Set<string>,
  to: string,
): string => {
  let result = svgText.replace(HEX_RGB_RE, (match) =>
    from.has(normalizeColor(match)) ? to : match,
  );
  result = result.replace(NAMED_PROP_RE, (match, prop, sep, quote, name) => {
    const hex = NAMED_COLORS[name.toLowerCase()];
    if (hex && from.has(hex)) return `${prop}${sep}${quote}${to}${quote}`;
    return match;
  });
  return result;
};

const sanitizeSvg = (svgText: string): string =>
  svgText.replace(/<script[\s\S]*?<\/script>/gi, "");

const svgColors = computed(() =>
  svgContent.value ? parseColorsFromSvg(svgContent.value) : [],
);

const toggleSvgColor = (color: string) => {
  const next = new Set(selectedSvgColors.value);
  if (next.has(color)) next.delete(color);
  else next.add(color);
  selectedSvgColors.value = next;
};

const applySvgColor = (newColor: string | null) => {
  if (!newColor || !svgContent.value || selectedSvgColors.value.size === 0)
    return;
  svgContent.value = replaceColorsInSvg(
    svgContent.value,
    selectedSvgColors.value,
    newColor,
  );
  svgModified.value = true;
  selectedSvgColors.value = new Set();
};

const loadSvgFromFile = (file: File) => {
  const reader = new FileReader();
  reader.onload = () => {
    svgContent.value = sanitizeSvg(reader.result as string);
    svgModified.value = false;
    selectedSvgColors.value = new Set();
  };
  reader.readAsText(file);
};

const isSvgUrl = (url: string): boolean => {
  const path = url.split("?")[0].split("#")[0].toLowerCase();
  return path.endsWith(".svg");
};

watchEffect(async () => {
  const remote = props.bookmark?.imageUrl;
  if (!remote || imageFile.value || removeImage.value) return;
  if (!isSvgUrl(remote)) return;
  if (svgContent.value) return;
  try {
    const res = await fetch(remote);
    if (!res.ok) {
      console.warn("[SVG] fetch falló:", res.status, remote);
      return;
    }
    const text = await res.text();
    svgContent.value = sanitizeSvg(text);
    svgModified.value = false;
    selectedSvgColors.value = new Set();
  } catch (err) {
    console.warn("[SVG] error al cargar:", err);
  }
});

const handleCopy = async () => {
  let imageDataUrl: string | null = null;
  let imageMimeType: string | null = null;
  if (svgModified.value && svgContent.value) {
    imageMimeType = "image/svg+xml";
    imageDataUrl =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgContent.value)));
  } else if (imageFile.value) {
    imageMimeType = imageFile.value.type;
    imageDataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(imageFile.value!);
    });
  } else if (currentImageUrl.value && !removeImage.value) {
    const fetched = await fetchImageAsDataUrl(currentImageUrl.value);
    if (fetched) {
      imageDataUrl = fetched.dataUrl;
      imageMimeType = fetched.mime;
    }
  }
  const payload: ImageClipboardData = {
    imageScale: imageScale.value,
    imageBgColor: imageBgColor.value,
    imageBgColor2: useGradient.value ? imageBgColor2.value : null,
    imageDataUrl,
    imageMimeType,
  };
  setClipboard(payload);
};

const handlePaste = () => {
  const data = clipboard.value;
  if (!data) return;
  imageScale.value = data.imageScale;
  imageBgColor.value = data.imageBgColor;
  imageBgColor2.value = data.imageBgColor2;
  useGradient.value = Boolean(data.imageBgColor2);
  if (data.imageDataUrl && data.imageMimeType) {
    const file = dataUrlToFile(data.imageDataUrl, data.imageMimeType);
    if (file) {
      imageFile.value = file;
      imagePreview.value = data.imageDataUrl;
      removeImage.value = false;
      if (data.imageMimeType === "image/svg+xml") {
        loadSvgFromFile(file);
      } else {
        svgContent.value = null;
        svgModified.value = false;
        selectedSvgColors.value = new Set();
      }
    }
  } else {
    imageFile.value = null;
    imagePreview.value = null;
    removeImage.value = true;
    svgContent.value = null;
    svgModified.value = false;
    selectedSvgColors.value = new Set();
  }
};

const addTag = (tag: string) => {
  const trimmed = tag.trim();
  if (!trimmed) return;
  if (!tags.value.includes(trimmed)) tags.value.push(trimmed);
  tagInput.value = "";
};

const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addTag(tagInput.value);
  } else if (
    event.key === "Backspace" &&
    !tagInput.value &&
    tags.value.length > 0
  ) {
    tags.value.pop();
  }
};

const removeTag = (tag: string) => {
  tags.value = tags.value.filter((t) => t !== tag);
};

watch(isMegaCard, (value) => {
  if (value) parentBookmarkId.value = "";
});

const handleSubmit = (event: Event) => {
  event.preventDefault();
  if (svgModified.value && svgContent.value) {
    const blob = new Blob([svgContent.value], { type: "image/svg+xml" });
    const fileName = imageFile.value?.name ?? "edited.svg";
    imageFile.value = new File([blob], fileName, { type: "image/svg+xml" });
    imagePreview.value =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgContent.value)));
    removeImage.value = false;
  }
  const input: BookmarkInput = {
    name: name.value.trim(),
    url: url.value.trim() || null,
    subtitle: subtitle.value.trim() || null,
    categoryId: categoryId.value || null,
    parentBookmarkId: isMegaCard.value ? null : parentBookmarkId.value || null,
    visibleAtStart: visibleAtStart.value,
    isMegaCard: isMegaCard.value,
    color: color.value,
    searchPlaceholder: searchPlaceholder.value.trim() || null,
    searchUrlTemplate: searchUrlTemplate.value.trim() || null,
    imageScale: imageScale.value < 1 ? imageScale.value : null,
    imageBgColor: imageBgColor.value || null,
    imageBgColor2: useGradient.value ? imageBgColor2.value || null : null,
    tags: tags.value,
  };
  emit("submit", {
    input,
    imageFile: imageFile.value,
    removeImage: removeImage.value,
  });
};

watch(
  () => props.bookmark?.id,
  () => {
    const b = props.bookmark;
    if (!b) return;
    name.value = b.name;
    url.value = b.url ?? "";
    subtitle.value = b.subtitle ?? "";
    categoryId.value = b.categoryId ?? "";
    parentBookmarkId.value = b.parentBookmarkId ?? "";
    visibleAtStart.value = b.visibleAtStart;
    isMegaCard.value = b.isMegaCard ?? false;
    color.value = b.color ?? null;
    searchPlaceholder.value = b.searchPlaceholder ?? "";
    searchUrlTemplate.value = b.searchUrlTemplate ?? "";
    imageScale.value = b.imageScale ?? 1;
    imageBgColor.value = b.imageBgColor ?? null;
    imageBgColor2.value = b.imageBgColor2 ?? null;
    useGradient.value = Boolean(b.imageBgColor2);
    tags.value = [...b.tags];
  },
);
</script>

<template>
  <form class="bm-form" @submit="handleSubmit">
    <div class="form-grid">
      <div class="image-block">
        <div class="image-preview" :style="previewStyle.thumb">
          <div
            v-if="svgContent"
            class="image-svg"
            :style="previewStyle.img"
            v-html="svgContent"
          />
          <img
            v-else-if="currentImageUrl"
            :src="currentImageUrl"
            :alt="name"
            :style="previewStyle.img"
          />
          <span v-else class="image-placeholder">Sin imagen</span>
        </div>

        <div class="image-toolbar">
          <div class="tb-row">
            <a
              :href="dashboardIconsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="tb-btn"
              title="Buscar icono en dashboardicons.com"
              aria-label="Buscar icono"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </a>

            <label
              class="tb-color"
              :title="imageBgColor ? `Color 1: ${imageBgColor}` : 'Color 1'"
            >
              <span
                class="tb-swatch"
                :style="{ background: imageBgColor || 'transparent' }"
              >
                <svg
                  v-if="!imageBgColor"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                >
                  <line x1="4" y1="20" x2="20" y2="4" />
                </svg>
              </span>
              <input type="color" v-model="bgColor1Hex" />
            </label>

            <button
              type="button"
              class="tb-btn tb-toggle"
              :class="{ active: useGradient }"
              :title="
                useGradient
                  ? 'Quitar segundo color'
                  : 'Añadir segundo color (degradado)'
              "
              @click="toggleGradient"
            >
              <span v-if="!useGradient">+</span>
              <span v-else>×</span>
            </button>

            <label
              v-if="useGradient"
              class="tb-color"
              :title="imageBgColor2 ? `Color 2: ${imageBgColor2}` : 'Color 2'"
            >
              <span
                class="tb-swatch"
                :style="{ background: imageBgColor2 || 'transparent' }"
              ></span>
              <input type="color" v-model="bgColor2Hex" />
            </label>

            <div
              class="tb-slider"
              :title="`Escala: ${Math.round(imageScale * 100)}%`"
            >
              <input
                v-model.number="imageScale"
                type="range"
                min="0.5"
                max="1"
                step="0.05"
              />
            </div>

            <button
              type="button"
              class="tb-btn tb-clear"
              :disabled="!imageBgColor && !imageBgColor2 && imageScale >= 1"
              title="Restablecer estilo"
              @click="
                handleClearBg();
                imageScale = 1;
              "
            >
              ⟲
            </button>
          </div>

          <div class="tb-row">
            <label
              class="tb-btn tb-file"
              title="Subir imagen"
              aria-label="Subir imagen"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif"
                hidden
                @change="handleImageChange"
              />
            </label>

            <button
              type="button"
              class="tb-btn"
              :disabled="!currentImageUrl"
              title="Quitar imagen"
              aria-label="Quitar imagen"
              @click="handleRemoveImage"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>

            <button
              type="button"
              class="tb-btn"
              title="Copiar bookmark"
              aria-label="Copiar bookmark"
              @click="handleCopy"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </button>

            <button
              type="button"
              class="tb-btn"
              :disabled="!hasClipboard"
              title="Pegar bookmark"
              aria-label="Pegar bookmark"
              @click="handlePaste"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
                />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </button>
          </div>

          <div v-if="svgColors.length > 0" class="tb-row tb-row-svg">
            <label
              class="tb-svg-trigger"
              :class="{ disabled: selectedSvgColors.size === 0 }"
              :title="
                selectedSvgColors.size === 0
                  ? 'Selecciona uno o más colores'
                  : `Cambiar color (${selectedSvgColors.size} seleccionados)`
              "
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="2.5" />
                <circle cx="8.5" cy="7.5" r="2.5" />
                <circle cx="6.5" cy="12.5" r="2.5" />
                <path
                  d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.77 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.27-.38-.62-.38-1.01 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.5-9-10-9z"
                />
              </svg>
              <input
                type="color"
                :disabled="selectedSvgColors.size === 0"
                aria-label="Cambiar color de elementos seleccionados"
                @input="
                  applySvgColor(($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <button
              v-for="c in svgColors"
              :key="c"
              type="button"
              class="tb-svg-color"
              :class="{ selected: selectedSvgColors.has(c) }"
              :style="{ background: c }"
              :title="c"
              :aria-label="`Color ${c}`"
              :aria-pressed="selectedSvgColors.has(c)"
              @click="toggleSvgColor(c)"
            />
          </div>
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
            <select v-model="parentBookmarkId" :disabled="isMegaCard">
              <option value="">— Ninguno —</option>
              <option v-for="b in possibleParents" :key="b.id" :value="b.id">
                {{ b.name }}
              </option>
            </select>
          </label>
        </div>

        <div class="color-row">
          <span class="label">Color</span>
          <CategoryColorPicker v-model="color" />
        </div>

        <label class="field toggle">
          <input v-model="visibleAtStart" type="checkbox" />
          <span>Visible en la home</span>
        </label>

        <label class="field toggle">
          <input v-model="isMegaCard" type="checkbox" />
          <span>Es Mega Card (puede tener bookmarks hijos)</span>
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
        <button type="button" class="btn btn-ghost" @click="emit('cancel')">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? "Guardando…" : bookmark ? "Guardar" : "Crear" }}
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
  .form-grid {
    grid-template-columns: 1fr;
  }
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
  position: relative;
}
.image-preview img,
.image-svg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.image-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.image-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: var(--bg-soft, #f3f1ec);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  color: var(--fg, #1c1a14);
}
.tb-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tb-row-svg {
  flex-wrap: wrap;
  row-gap: 6px;
}

.tb-btn {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 6px;
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  text-decoration: none;
  flex-shrink: 0;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}
.tb-btn:hover:not(:disabled) {
  background: var(--bg-softer, #ecebe5);
  border-color: var(--border-strong, rgba(28, 26, 20, 0.24));
}
.tb-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tb-toggle.active {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border-color: var(--fg, #1c1a14);
}
.tb-file {
  position: relative;
}

.tb-color {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
}
.tb-swatch {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: repeating-conic-gradient(#bbb 0 25%, #ddd 0 50%) 50% / 8px 8px;
  color: var(--fg-soft, #7a7468);
}
.tb-color input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  opacity: 0;
  cursor: pointer;
}

.tb-slider {
  flex: 1;
  min-width: 60px;
  display: flex;
  align-items: center;
}
.tb-slider input[type="range"] {
  width: 100%;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--fg, #1c1a14);
  background: transparent;
}

.tb-clear {
  font-size: 14px;
}

.tb-svg-color {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 0.5px solid var(--border-strong, rgba(28, 26, 20, 0.24));
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}
.tb-svg-color:hover {
  transform: scale(1.08);
}
.tb-svg-color.selected {
  outline: 2px solid var(--fg, #1c1a14);
  outline-offset: 1px;
  box-shadow: 0 0 0 1px var(--bg-elev, #ffffff) inset;
}

.tb-svg-trigger {
  position: relative;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.16));
  border-radius: 6px;
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 120ms ease,
    border-color 120ms ease;
}
.tb-svg-trigger:hover {
  background: var(--bg-softer, #ecebe5);
  border-color: var(--border-strong, rgba(28, 26, 20, 0.24));
}
.tb-svg-trigger.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tb-svg-trigger.disabled:hover {
  background: var(--bg-elev, #ffffff);
  border-color: var(--border, rgba(28, 26, 20, 0.16));
}
.tb-svg-trigger input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  opacity: 0;
  cursor: pointer;
}
.tb-svg-trigger input[type="color"]:disabled {
  cursor: not-allowed;
}
.image-placeholder {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
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
  .row {
    grid-template-columns: 1fr;
  }
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

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.color-row .label {
  margin: 0;
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
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease;
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
