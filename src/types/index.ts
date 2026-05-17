export interface Widget {
  id: string
  bookmarkId: string
  type: string
  order: number
  config: Record<string, unknown>
}

export interface Bookmark {
  id: string
  name: string
  url: string
  subtitle?: string
  tags: string[]
  categoryId?: string
  visibleAtStart: boolean
  imageUrl?: string

  // Marca explícita: este bookmark actúa como padre/contenedor de mega card.
  // Una mega card no puede tener `parentBookmarkId`. Solo bookmarks con
  // `isMegaCard === true` son candidatos válidos como padre.
  isMegaCard: boolean

  // Mega card grouping (parent bookmark has no url; children reference parent.id)
  parentBookmarkId?: string

  // Hex accent color (#rrggbb). When absent, derived from category or id hash.
  color?: string | null

  // Inline site search: opens searchUrlTemplate.replace('{q}', encodeURIComponent(query)) in a new tab.
  searchPlaceholder?: string
  searchUrlTemplate?: string

  // Image styling overrides. imageScale 0.5–1; bg colors any CSS color string.
  // Si imageBgColor2 es null/undefined no hay degradado.
  imageScale?: number | null
  imageBgColor?: string | null
  imageBgColor2?: string | null

  // Generic JSON metadata for the resboard feature.
  resboard?: Record<string, unknown> | null

  widgets?: Widget[]
}

export interface Category {
  id: string
  name: string
  order: number
  padreId?: string
  color?: string | null
  hijoIds?: string[]
}

export interface CacheData<T> {
  data: T
  timestamp: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
