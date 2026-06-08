import axios from 'axios'
import type { AlternateUrl, Bookmark, Category, ApiResponse } from '@/types'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
})

export interface ApiError extends Error {
  status?: number
  details?: Record<string, unknown>
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as { error?: unknown; details?: unknown } | undefined
      if (body && typeof body.error === 'string' && body.error) {
        const wrapped: ApiError = new Error(body.error)
        wrapped.status = error.response?.status
        if (body.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
          wrapped.details = body.details as Record<string, unknown>
        }
        return Promise.reject(wrapped)
      }
    }
    return Promise.reject(error)
  }
)

export { api }

const unwrap = <T>(response: { data: ApiResponse<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'API error')
  }
  return response.data.data
}

export interface AuthUser {
  id: string
  username: string
  isAdmin: boolean
}

export interface ManagedUser {
  id: string
  username: string
  isAdmin: boolean
  createdAt: string
}

export const login = async (username: string, password: string): Promise<AuthUser> => {
  const response = await api.post<ApiResponse<AuthUser>>('/auth/login', { username, password })
  return unwrap(response)
}

export const logout = async (): Promise<void> => {
  await api.post<ApiResponse<{ ok: true }>>('/auth/logout', {})
}

export const fetchMe = async (): Promise<AuthUser | null> => {
  try {
    const response = await api.get<ApiResponse<AuthUser>>('/auth/me')
    return unwrap(response)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) return null
    throw err
  }
}

export const fetchUsers = async (): Promise<ManagedUser[]> => {
  const response = await api.get<ApiResponse<ManagedUser[]>>('/users')
  return unwrap(response)
}

export const createUserApi = async (input: { username: string; password: string; isAdmin?: boolean }): Promise<ManagedUser> => {
  const response = await api.post<ApiResponse<ManagedUser>>('/users', input)
  return unwrap(response)
}

export const updateUserApi = async (id: string, input: { password?: string; isAdmin?: boolean }): Promise<ManagedUser> => {
  const response = await api.put<ApiResponse<ManagedUser>>(`/users/${id}`, input)
  return unwrap(response)
}

export const deleteUserApi = async (id: string): Promise<void> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/users/${id}`)
  unwrap(response)
}

export interface BookmarkInput {
  name: string
  url?: string | null
  subtitle?: string | null
  categoryId?: string | null
  parentBookmarkId?: string | null
  visibleAtStart?: boolean
  isMegaCard?: boolean
  color?: string | null
  searchPlaceholder?: string | null
  searchUrlTemplate?: string | null
  imageUrl?: string | null
  imageScale?: number | null
  imageBgColor?: string | null
  imageBgColor2?: string | null
  tags?: string[]
  resboard?: Record<string, unknown> | null
  alternateUrls?: AlternateUrl[] | null
  valoration?: number | null
}

export interface CategoryInput {
  name: string
  order?: number
  padreId?: string | null
  color?: string | null
}

export interface CategoryReorderEntry {
  id: string
  order: number
  padreId: string | null
}

export const fetchBookmarks = async (): Promise<Bookmark[]> => {
  const response = await api.get<ApiResponse<Bookmark[]>>('/bookmarks')
  return unwrap(response)
}

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get<ApiResponse<Category[]>>('/categories')
  return unwrap(response)
}

export const fetchTags = async (): Promise<string[]> => {
  const response = await api.get<ApiResponse<string[]>>('/bookmarks/tags')
  return unwrap(response)
}

export const createBookmark = async (input: BookmarkInput): Promise<Bookmark> => {
  const response = await api.post<ApiResponse<Bookmark>>('/bookmarks', input)
  return unwrap(response)
}

export const updateBookmark = async (id: string, input: Partial<BookmarkInput>): Promise<Bookmark> => {
  const response = await api.put<ApiResponse<Bookmark>>(`/bookmarks/${id}`, input)
  return unwrap(response)
}

export const deleteBookmark = async (id: string): Promise<void> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/bookmarks/${id}`)
  unwrap(response)
}

export const uploadBookmarkImage = async (id: string, file: File): Promise<Bookmark> => {
  const form = new FormData()
  form.append('image', file)
  const response = await api.post<ApiResponse<Bookmark>>(`/bookmarks/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return unwrap(response)
}

export const deleteBookmarkImage = async (id: string): Promise<Bookmark> => {
  const response = await api.delete<ApiResponse<Bookmark>>(`/bookmarks/${id}/image`)
  return unwrap(response)
}

export const createCategory = async (input: CategoryInput): Promise<Category> => {
  const response = await api.post<ApiResponse<Category>>('/categories', input)
  return unwrap(response)
}

export const updateCategory = async (id: string, input: Partial<CategoryInput>): Promise<Category> => {
  const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, input)
  return unwrap(response)
}

export const deleteCategoryById = async (id: string): Promise<void> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/categories/${id}`)
  unwrap(response)
}

export const reorderCategories = async (updates: CategoryReorderEntry[]): Promise<Category[]> => {
  const response = await api.put<ApiResponse<Category[]>>('/categories/reorder', updates)
  return unwrap(response)
}
