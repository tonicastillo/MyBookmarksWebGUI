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
  valoration?: string
  imageUrl?: string
  createdTime: string
  parentBookmarkId?: string
  colorHue?: number
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

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}
