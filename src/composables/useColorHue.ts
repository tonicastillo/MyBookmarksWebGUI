import type { Bookmark } from '@/types'

/**
 * Hash determinista (FNV-1a 32-bit) → entero positivo.
 */
const hashString = (input: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Genera una tonalidad estable (0–360) a partir de un id arbitrario.
 * Mismo id ⇒ misma tonalidad.
 */
export const hueFromId = (id: string | undefined | null): number => {
  if (!id) return 220
  return hashString(id) % 360
}

/**
 * Resuelve la tonalidad efectiva de un bookmark:
 * 1. Override explícito en `colorHue` (campo de Notion).
 * 2. Derivada de la categoría.
 * 3. Fallback derivado del propio id.
 */
export const resolveBookmarkHue = (bookmark: Bookmark): number => {
  if (typeof bookmark.colorHue === 'number') return bookmark.colorHue
  if (bookmark.categoryId) return hueFromId(bookmark.categoryId)
  return hueFromId(bookmark.id)
}
