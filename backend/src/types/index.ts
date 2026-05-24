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
  isMegaCard: boolean
  imageUrl?: string
  parentBookmarkId?: string
  color?: string | null
  searchPlaceholder?: string
  searchUrlTemplate?: string
  imageScale?: number | null
  imageBgColor?: string | null
  imageBgColor2?: string | null
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

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

export interface User {
  id: string
  username: string
  isAdmin: boolean
  createdAt: string
}

export interface Credential {
  id: string
  userId: string
  type: string
  name: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AuthUser {
  id: string
  username: string
  isAdmin: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
