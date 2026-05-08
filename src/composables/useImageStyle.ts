import type { CSSProperties } from 'vue'
import type { Bookmark } from '@/types'

export interface BookmarkImageStyle {
  thumb: CSSProperties
  img: CSSProperties
}

export const buildImageStyle = (bookmark: Pick<Bookmark, 'imageScale' | 'imageBgColor' | 'imageBgColor2'>): BookmarkImageStyle => {
  const thumb: CSSProperties = {}
  const img: CSSProperties = {}

  const c1 = bookmark.imageBgColor ?? null
  const c2 = bookmark.imageBgColor2 ?? null

  if (c1 && c2) {
    thumb.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`
  } else if (c1) {
    thumb.background = c1
  } else if (c2) {
    thumb.background = c2
  }

  const scale = typeof bookmark.imageScale === 'number' ? bookmark.imageScale : null
  if (scale !== null && scale < 1) {
    const pct = Math.max(50, Math.min(100, Math.round(scale * 100)))
    img.width = `${pct}%`
    img.height = `${pct}%`
    img.margin = 'auto'
    img.objectFit = 'contain'
  }

  return { thumb, img }
}
