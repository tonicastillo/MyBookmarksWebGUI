import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Bookmark } from '@/types'

/**
 * Configuración del motor difuso (Fuse.js) para bookmarks.
 *
 * - `threshold: 0.4` tolera erratas y transposiciones ("gogle" → "Google")
 *   sin llegar a devolver resultados sin relación.
 * - `ignoreLocation` permite que la coincidencia aparezca en cualquier
 *   posición del texto, no solo al principio.
 * - `ignoreDiacritics` hace que "camara" encuentre "Cámara".
 * - Los pesos priorizan el nombre sobre las etiquetas y el subtítulo.
 */
const FUSE_OPTIONS: IFuseOptions<Bookmark> = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'subtitle', weight: 0.2 }
  ],
  includeScore: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: 0.4,
  minMatchCharLength: 2
}

/** Longitud mínima de consulta para usar el motor difuso. */
const MIN_FUZZY_LENGTH = 2

export const createBookmarkFuse = (bookmarks: Bookmark[]): Fuse<Bookmark> =>
  new Fuse(bookmarks, FUSE_OPTIONS)

const normalize = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Coincidencia por subcadena para consultas de un solo carácter, donde el
 * motor difuso no aporta nada (y `minMatchCharLength` lo descartaría todo).
 * Devuelve score 0 (coincidencia exacta) para todos los aciertos.
 */
const substringMatches = (bookmarks: Bookmark[], query: string): Map<string, number> => {
  const q = normalize(query)
  const scores = new Map<string, number>()

  bookmarks.forEach((b) => {
    const haystack = [b.name, b.subtitle ?? '', ...b.tags].map(normalize)
    if (haystack.some((text) => text.includes(q))) scores.set(b.id, 0)
  })

  return scores
}

/**
 * Busca `query` con tolerancia a errores y devuelve un mapa
 * `bookmarkId → score`, donde 0 es coincidencia perfecta y 1 la peor
 * aceptada. Una consulta vacía devuelve un mapa vacío.
 */
export const fuzzySearchBookmarks = (
  fuse: Fuse<Bookmark>,
  bookmarks: Bookmark[],
  query: string
): Map<string, number> => {
  const q = query.trim()
  if (!q) return new Map()
  if (q.length < MIN_FUZZY_LENGTH) return substringMatches(bookmarks, q)

  const scores = new Map<string, number>()
  fuse.search(q).forEach(({ item, score }) => {
    scores.set(item.id, score ?? 0)
  })
  return scores
}

/**
 * Agrupa los scores en tramos de 0.1 para poder ordenar primero por
 * relevancia y, entre resultados de calidad equivalente, por otro criterio
 * (la valoración). Evita que diferencias mínimas de score decidan el orden.
 */
export const relevanceBucket = (score: number): number => Math.round(score * 10)
