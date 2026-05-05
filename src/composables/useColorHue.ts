import type { Bookmark } from '@/types'

const HEX_RE = /^#([0-9a-fA-F]{6})$/

export const hueFromHex = (hex: string | null | undefined): number | null => {
  if (!hex) return null
  const match = HEX_RE.exec(hex)
  if (!match) return null
  const num = parseInt(match[1], 16)
  const r = ((num >> 16) & 0xff) / 255
  const g = ((num >> 8) & 0xff) / 255
  const b = (num & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  let h = 0
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  h = Math.round(h * 60)
  if (h < 0) h += 360
  return h
}

export const resolveBookmarkHue = (
  bookmark: Bookmark,
  categoryColor?: string | null,
): number | null => {
  const fromBookmarkColor = hueFromHex(bookmark.color)
  if (fromBookmarkColor !== null) return fromBookmarkColor
  return hueFromHex(categoryColor)
}
