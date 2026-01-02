import axios from 'axios'
import type { Bookmark, Category, ApiResponse } from '@/types'

const api = axios.create({
  baseURL: '/api'
})

export const fetchBookmarks = async (): Promise<Bookmark[]> => {
  const response = await api.get<ApiResponse<Bookmark[]>>('/bookmarks')
  if (!response.data.success) {
    throw new Error(response.data.error || 'Error fetching bookmarks')
  }
  return response.data.data
}

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get<ApiResponse<Category[]>>('/categories')
  if (!response.data.success) {
    throw new Error(response.data.error || 'Error fetching categories')
  }
  return response.data.data
}
