import type { CacheData } from '@/types'

const CACHE_PREFIX = 'mybookmarks_'
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

export const useCache = () => {
  const saveToCache = <T>(key: string, data: T): void => {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData))
  }

  const getFromCache = <T>(key: string): T | null => {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null

    try {
      const cacheData: CacheData<T> = JSON.parse(cached)
      return cacheData.data
    } catch {
      return null
    }
  }

  const isCacheValid = (key: string, maxAge: number = DEFAULT_MAX_AGE): boolean => {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return false

    try {
      const cacheData: CacheData<unknown> = JSON.parse(cached)
      return Date.now() - cacheData.timestamp < maxAge
    } catch {
      return false
    }
  }

  const getCacheTimestamp = (key: string): number | null => {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null

    try {
      const cacheData: CacheData<unknown> = JSON.parse(cached)
      return cacheData.timestamp
    } catch {
      return null
    }
  }

  const clearCache = (key?: string): void => {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key)
    } else {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i)
        if (storageKey?.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(storageKey)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    }
  }

  return {
    saveToCache,
    getFromCache,
    isCacheValid,
    getCacheTimestamp,
    clearCache
  }
}
