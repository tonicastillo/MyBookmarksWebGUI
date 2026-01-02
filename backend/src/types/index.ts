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
  imageUrlDark?: string
  createdTime: string
}

/**
 * Bookmark con URLs originales de Notion (para sincronización S3)
 */
export interface BookmarkWithOriginalImages extends Bookmark {
  originalImageUrl?: string
  originalImageUrlDark?: string
}

export interface Category {
  id: string
  name: string
  order: number
  level?: number
  padreId?: string
  hijoIds?: string[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
