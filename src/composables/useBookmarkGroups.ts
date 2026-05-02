import type { Bookmark } from '@/types'

export interface BookmarkGroup {
  /** Bookmark visible en el grid (puede ser padre o suelto). */
  bookmark: Bookmark
  /** Hijos cuando `bookmark` es padre de mega card. */
  children: Bookmark[]
}

/**
 * Agrupa bookmarks en mega cards (padre + hijos) y bookmarks sueltos.
 *
 * Reglas:
 * - Un bookmark es padre si algún otro bookmark lo referencia con `parentBookmarkId`.
 * - Los hijos se asocian a su padre y se quitan del listado plano.
 * - Si un bookmark referencia un padre que NO está en el set, se trata como bookmark suelto.
 * - El orden se preserva según el array de entrada.
 */
export const groupBookmarksByParent = (bookmarks: Bookmark[]): BookmarkGroup[] => {
  const byId = new Map<string, Bookmark>()
  bookmarks.forEach((b) => byId.set(b.id, b))

  const childrenByParent = new Map<string, Bookmark[]>()
  const childIds = new Set<string>()

  bookmarks.forEach((b) => {
    if (!b.parentBookmarkId) return
    if (!byId.has(b.parentBookmarkId)) return
    const list = childrenByParent.get(b.parentBookmarkId) ?? []
    list.push(b)
    childrenByParent.set(b.parentBookmarkId, list)
    childIds.add(b.id)
  })

  const groups: BookmarkGroup[] = []
  bookmarks.forEach((b) => {
    if (childIds.has(b.id)) return
    groups.push({
      bookmark: b,
      children: childrenByParent.get(b.id) ?? []
    })
  })

  return groups
}
