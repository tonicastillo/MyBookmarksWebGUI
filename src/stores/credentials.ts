import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Credential } from '@/types'
import {
  fetchCredentials,
  createCredentialApi,
  updateCredentialApi,
  deleteCredentialApi,
  type CredentialInput
} from '@/api/credentials'
import { useCache } from '@/composables/useCache'
import { credentialTypeIdsByCategory, type CredentialCategory } from '@/credentials/registry'

const CACHE_KEY = 'credentials'

export const useCredentialsStore = defineStore('credentials', () => {
  const credentials = ref<Credential[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)

  const { saveToCache, getFromCache, isCacheValid, clearCache } = useCache()

  const byId = (id: string): Credential | undefined =>
    credentials.value.find((c) => c.id === id)

  const byType = (type: string): Credential[] =>
    credentials.value.filter((c) => c.type === type)

  const byCategory = (category: CredentialCategory): Credential[] => {
    const ids = new Set(credentialTypeIdsByCategory(category))
    return credentials.value.filter((c) => ids.has(c.type))
  }

  const loadCredentials = async (forceRefresh = false): Promise<void> => {
    const cached = getFromCache<Credential[]>(CACHE_KEY)
    const hasCached = cached && cached.length > 0

    if (hasCached) {
      credentials.value = cached
      if (!forceRefresh && isCacheValid(CACHE_KEY)) return
    }

    if (!hasCached) loading.value = true
    else refreshing.value = true
    error.value = null

    try {
      const data = await fetchCredentials()
      credentials.value = data
      saveToCache(CACHE_KEY, data)
    } catch (e) {
      if (!hasCached) {
        error.value = e instanceof Error ? e.message : 'Error cargando credenciales'
      }
      console.error('Error loading credentials:', e)
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  const upsertLocal = (cred: Credential): void => {
    const idx = credentials.value.findIndex((c) => c.id === cred.id)
    if (idx >= 0) credentials.value.splice(idx, 1, cred)
    else credentials.value.push(cred)
    saveToCache(CACHE_KEY, credentials.value)
  }

  const removeLocal = (id: string): void => {
    credentials.value = credentials.value.filter((c) => c.id !== id)
    saveToCache(CACHE_KEY, credentials.value)
  }

  const create = async (input: CredentialInput): Promise<Credential> => {
    const created = await createCredentialApi(input)
    upsertLocal(created)
    return created
  }

  const update = async (id: string, input: { name?: string; data?: Record<string, unknown> }): Promise<Credential> => {
    const updated = await updateCredentialApi(id, input)
    upsertLocal(updated)
    return updated
  }

  const remove = async (id: string): Promise<void> => {
    await deleteCredentialApi(id)
    removeLocal(id)
  }

  const invalidate = (): void => {
    clearCache(CACHE_KEY)
  }

  const all = computed(() => credentials.value)

  return {
    credentials,
    all,
    loading,
    refreshing,
    error,
    byId,
    byType,
    byCategory,
    loadCredentials,
    create,
    update,
    remove,
    invalidate
  }
})
