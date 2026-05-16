import { ref, computed } from "vue";

export interface ImageClipboardData {
  imageScale: number;
  imageBgColor: string | null;
  imageBgColor2: string | null;
  imageDataUrl: string | null;
  imageMimeType: string | null;
}

const STORAGE_KEY = "mb2026.imageClipboard";

const loadInitial = (): ImageClipboardData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImageClipboardData;
  } catch {
    return null;
  }
};

const clipboard = ref<ImageClipboardData | null>(loadInitial());

const setClipboard = (data: ImageClipboardData) => {
  clipboard.value = data;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
};

const clearClipboard = () => {
  clipboard.value = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

export const useImageClipboard = () => ({
  clipboard: computed(() => clipboard.value),
  hasClipboard: computed(() => clipboard.value !== null),
  setClipboard,
  clearClipboard,
});
