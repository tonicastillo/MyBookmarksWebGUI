import axios from 'axios'
import type { ApiResponse, Bookmark } from '@/types'

const api = axios.create({ baseURL: '/api' })

const unwrap = <T>(response: { data: ApiResponse<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'API error')
  }
  return response.data.data
}

export interface CreateWidgetInput {
  bookmarkId: string
  type: string
  config?: Record<string, unknown>
}

export const createWidget = async (input: CreateWidgetInput): Promise<Bookmark> => {
  const response = await api.post<ApiResponse<Bookmark>>('/widgets', input)
  return unwrap(response)
}

export const updateWidget = async (id: string, config: Record<string, unknown>): Promise<Bookmark> => {
  const response = await api.put<ApiResponse<Bookmark>>(`/widgets/${id}`, { config })
  return unwrap(response)
}

export const deleteWidget = async (id: string): Promise<Bookmark> => {
  const response = await api.delete<ApiResponse<Bookmark>>(`/widgets/${id}`)
  return unwrap(response)
}

export const reorderWidgets = async (bookmarkId: string, ids: string[]): Promise<Bookmark> => {
  const response = await api.post<ApiResponse<Bookmark>>('/widgets/reorder', { bookmarkId, ids })
  return unwrap(response)
}

export interface UnraidContainerInfo {
  id: string | null
  name: string
  image: string | null
  state: string | null
  status: string | null
  autoStart: boolean | null
  sizeRootFs: number | null
  cpuPercent: number | null
  memPercent: number | null
  memUsage: string | null
}

export type UnraidAction = 'start' | 'stop' | 'restart'

export const fetchUnraidStatus = async (widgetId: string): Promise<UnraidContainerInfo> => {
  const response = await api.get<ApiResponse<UnraidContainerInfo>>(`/widgets/${widgetId}/unraid/status`)
  return unwrap(response)
}

export const runUnraidAction = async (widgetId: string, action: UnraidAction): Promise<UnraidContainerInfo> => {
  const response = await api.post<ApiResponse<UnraidContainerInfo>>(`/widgets/${widgetId}/unraid/action`, { action })
  return unwrap(response)
}
