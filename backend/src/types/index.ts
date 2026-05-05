export interface Bookmark {
  id: string
  name: string
  url: string
  subtitle?: string
  tags: string[]
  categoryId?: string
  visibleAtStart: boolean
  imageUrl?: string
  parentBookmarkId?: string
  color?: string | null
  searchPlaceholder?: string
  searchUrlTemplate?: string
  resboard?: Record<string, unknown> | null
}

export interface Category {
  id: string
  name: string
  order: number
  padreId?: string
  color?: string | null
  hijoIds?: string[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
