import { api } from '@/api/notion'
import type { ApiResponse, Credential } from '@/types'

const unwrap = <T>(response: { data: ApiResponse<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'API error')
  }
  return response.data.data
}

export interface CredentialInput {
  type: string
  name: string
  data: Record<string, unknown>
}

export const fetchCredentials = async (type?: string): Promise<Credential[]> => {
  const response = await api.get<ApiResponse<Credential[]>>('/credentials', {
    params: type ? { type } : undefined
  })
  return unwrap(response)
}

export const createCredentialApi = async (input: CredentialInput): Promise<Credential> => {
  const response = await api.post<ApiResponse<Credential>>('/credentials', input)
  return unwrap(response)
}

export const updateCredentialApi = async (id: string, input: { name?: string; data?: Record<string, unknown> }): Promise<Credential> => {
  const response = await api.put<ApiResponse<Credential>>(`/credentials/${id}`, input)
  return unwrap(response)
}

export const deleteCredentialApi = async (id: string): Promise<void> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/credentials/${id}`)
  unwrap(response)
}
