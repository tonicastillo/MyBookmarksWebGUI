export interface Bookmark {
  id: string
  name: string
  url: string
  alternateUrl?: string
  subtitle?: string
  tags: string[]
  categoryId?: string
  visibleAtStart: boolean
  status: 'Not started' | 'In progress' | 'Done'
  valoration?: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐'
  imageUrl?: string
  createdTime: string

  // Mega card grouping (parent bookmark has no url; children reference parent.id)
  parentBookmarkId?: string

  // Per-bookmark accent hue override (0–360). When absent, derived from category.
  colorHue?: number

  // Inline site search: opens searchUrlTemplate.replace('{q}', encodeURIComponent(query)) in a new tab.
  searchPlaceholder?: string
  searchUrlTemplate?: string
}

export interface Category {
  id: string
  name: string
  order: number
  level?: number
  padreId?: string
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
