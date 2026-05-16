import type { Bookmark } from "@/types";
import { fetchImageAsDataUrl } from "./useBookmarkImageTransfer";

export interface BookmarkDuplicateData {
  name: string;
  url: string;
  subtitle: string;
  categoryId: string;
  parentBookmarkId: string;
  visibleAtStart: boolean;
  isMegaCard: boolean;
  color: string | null;
  searchPlaceholder: string;
  searchUrlTemplate: string;
  tags: string[];
  imageScale: number;
  imageBgColor: string | null;
  imageBgColor2: string | null;
  imageDataUrl: string | null;
  imageMimeType: string | null;
}

let pending: BookmarkDuplicateData | null = null;

export const useBookmarkDuplicate = () => ({
  setPendingDuplicate: (data: BookmarkDuplicateData) => {
    pending = data;
  },
  consumePendingDuplicate: (): BookmarkDuplicateData | null => {
    const data = pending;
    pending = null;
    return data;
  },
  hasPendingDuplicate: (): boolean => pending !== null,
});

export const buildDuplicatePayload = async (
  bookmark: Bookmark,
): Promise<BookmarkDuplicateData> => {
  let imageDataUrl: string | null = null;
  let imageMimeType: string | null = null;
  if (bookmark.imageUrl) {
    const fetched = await fetchImageAsDataUrl(bookmark.imageUrl);
    if (fetched) {
      imageDataUrl = fetched.dataUrl;
      imageMimeType = fetched.mime;
    }
  }

  return {
    name: `${bookmark.name} (copia)`,
    url: bookmark.url ?? "",
    subtitle: bookmark.subtitle ?? "",
    categoryId: bookmark.categoryId ?? "",
    parentBookmarkId: bookmark.isMegaCard
      ? ""
      : (bookmark.parentBookmarkId ?? ""),
    visibleAtStart: bookmark.visibleAtStart,
    isMegaCard: bookmark.isMegaCard,
    color: bookmark.color ?? null,
    searchPlaceholder: bookmark.searchPlaceholder ?? "",
    searchUrlTemplate: bookmark.searchUrlTemplate ?? "",
    tags: [...bookmark.tags],
    imageScale: bookmark.imageScale ?? 1,
    imageBgColor: bookmark.imageBgColor ?? null,
    imageBgColor2: bookmark.imageBgColor2 ?? null,
    imageDataUrl,
    imageMimeType,
  };
};
