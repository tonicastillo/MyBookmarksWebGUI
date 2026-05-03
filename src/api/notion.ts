import axios from 'axios'
import type { Bookmark, Category, ApiResponse } from '@/types'

const api = axios.create({
  baseURL: '/api'
})

export interface BookmarkInput {
  name: string
  url?: string | null
  alternateUrl?: string | null
  subtitle?: string | null
  categoryId?: string | null
  parentBookmarkId?: string | null
  visibleAtStart?: boolean
  status?: Bookmark['status']
  valoration?: string | null
  colorHue?: number | null
  searchPlaceholder?: string | null
  searchUrlTemplate?: string | null
  imageUrl?: string | null
  tags?: string[]
}

export interface CategoryInput {
  name: string
  order?: number
  level?: number | null
  padreId?: string | null
}

const unwrap = <T>(response: { data: ApiResponse<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'API error')
  }
  return response.data.data
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
