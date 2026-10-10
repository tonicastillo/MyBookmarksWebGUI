// Índice y búsqueda de bookmarks. Misma configuración difusa que la app
// (src/composables/useFuzzySearch.ts) para que los resultados coincidan.
import Fuse from './fuse.min.mjs'

const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'subtitle', weight: 0.2 },
    { name: 'parentName', weight: 0.1 }
  ],
  includeScore: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: 0.4,
  minMatchCharLength: 2
}

const normalize = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Construye el índice a partir de la caché. Solo entran en la búsqueda los
 * bookmarks con URL (los padres de mega card no tienen); los hijos llevan el
 * nombre del padre y heredan su imagen si no tienen una propia.
 */
export const buildIndex = ({ bookmarks, categories }) => {
  const byId = new Map(bookmarks.map((b) => [b.id, b]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const entries = bookmarks
    .filter((b) => b.url)
    .map((b) => {
      const parent = b.parentBookmarkId ? byId.get(b.parentBookmarkId) : null
      const categoryId = b.categoryId ?? parent?.categoryId
      return {
        ...b,
        parentName: parent?.name ?? '',
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? '',
        imageUrl: b.imageUrl || parent?.imageUrl || ''
      }
    })

  return { entries, bookmarks, categories, fuse: new Fuse(entries, FUSE_OPTIONS) }
}

/** Resultados para una consulta: por relevancia (tramos de 0.1) y, a igualdad, por valoración. */
export const search = (index, query, limit = 50) => {
  const q = query.trim()
  if (!q) return []

  const scored = q.length < 2
    ? index.entries
      .filter((e) => [e.name, e.subtitle ?? '', e.parentName, ...e.tags].some((t) => normalize(t).includes(normalize(q))))
      .map((item) => ({ item, score: 0 }))
    : index.fuse.search(q)

  return scored
    .map(({ item, score }) => ({ item, bucket: Math.round((score ?? 0) * 10) }))
    .sort((a, b) => a.bucket - b.bucket || (b.item.valoration ?? 0) - (a.item.valoration ?? 0))
    .slice(0, limit)
    .map(({ item }) => item)
}

/**
 * Árbol para navegar sin búsqueda:
 *   categoría → subcategorías → mega cards → bookmarks
 *
 * Nodos: `{ type: 'category' | 'mega', id, name, children, count }` y
 * `{ type: 'bookmark', id, entry }`. `count` es el nº de bookmarks con URL
 * que cuelgan del nodo; las ramas vacías se descartan.
 */
export const buildTree = (index) => {
  const entryById = new Map(index.entries.map((e) => [e.id, e]))
  const bookmarkIds = new Set(index.bookmarks.map((b) => b.id))
  const leaf = (entry) => ({ type: 'bookmark', id: entry.id, entry })

  // Hijos de mega card (solo si el padre existe).
  const childrenOf = new Map()
  index.entries.forEach((e) => {
    if (!e.parentBookmarkId || !bookmarkIds.has(e.parentBookmarkId)) return
    if (!childrenOf.has(e.parentBookmarkId)) childrenOf.set(e.parentBookmarkId, [])
    childrenOf.get(e.parentBookmarkId).push(leaf(e))
  })

  // Elementos de primer nivel de cada categoría: mega cards y bookmarks sueltos.
  const itemsByCategory = new Map()
  index.bookmarks.forEach((b) => {
    if (b.parentBookmarkId && bookmarkIds.has(b.parentBookmarkId)) return
    let node = null
    if (childrenOf.has(b.id)) {
      node = { type: 'mega', id: b.id, name: b.name, bookmark: entryById.get(b.id) ?? b, children: childrenOf.get(b.id) }
    } else if (entryById.has(b.id)) {
      node = leaf(entryById.get(b.id))
    }
    if (!node) return
    const key = b.categoryId ?? ''
    if (!itemsByCategory.has(key)) itemsByCategory.set(key, [])
    itemsByCategory.get(key).push(node)
  })

  // Categorías anidadas por padreId, en el orden de la app.
  const sorted = [...index.categories].sort((a, b) => a.order - b.order)
  const categoryIds = new Set(sorted.map((c) => c.id))
  const nodeById = new Map(sorted.map((c) => [c.id, { type: 'category', id: c.id, name: c.name, children: [] }]))
  const roots = []
  sorted.forEach((c) => {
    const node = nodeById.get(c.id)
    const parent = c.padreId && categoryIds.has(c.padreId) ? nodeById.get(c.padreId) : null
    ;(parent ? parent.children : roots).push(node)
  })
  // Subcategorías primero, luego los bookmarks de la propia categoría.
  nodeById.forEach((node, id) => node.children.push(...(itemsByCategory.get(id) ?? [])))

  const orphans = [...itemsByCategory.entries()]
    .filter(([key]) => !categoryIds.has(key))
    .flatMap(([, items]) => items)
  if (orphans.length) roots.push({ type: 'category', id: '__none__', name: 'Sin categoría', children: orphans })

  const prune = (nodes) => nodes.filter((node) => {
    if (node.type === 'bookmark') return true
    node.children = prune(node.children)
    node.count = node.children.reduce((sum, child) => sum + (child.type === 'bookmark' ? 1 : child.count), 0)
    return node.count > 0
  })
  return prune(roots)
}
