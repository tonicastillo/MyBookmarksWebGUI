import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  type AuthUser
} from '@/api/client'
import { useCache } from '@/composables/useCache'

const SESSION_USER_KEY = 'mybookmarks_session_user'

const readCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

const writeCachedUser = (user: AuthUser | null): void => {
  if (user) {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(SESSION_USER_KEY)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthUser | null>(readCachedUser())
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => currentUser.value !== null)
  const isAdmin = computed(() => currentUser.value?.isAdmin === true)

  const { clearCache } = useCache()

  const setUser = (user: AuthUser | null): void => {
    const previousId = currentUser.value?.id ?? null
    const nextId = user?.id ?? null
    if (previousId && previousId !== nextId) {
      clearCache()
    }
    currentUser.value = user
    writeCachedUser(user)
  }

  const fetchCurrentUser = async (): Promise<AuthUser | null> => {
    try {
      const user = await fetchMe()
      setUser(user)
      return user
    } catch (e) {
      console.error('Error fetching session:', e)
      return currentUser.value
    } finally {
      initialized.value = true
    }
  }

  const login = async (username: string, password: string): Promise<AuthUser> => {
    loading.value = true
    error.value = null
    try {
      const user = await apiLogin(username, password)
      setUser(user)
      return user
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error iniciando sesión'
      error.value = message
      throw e
    } finally {
      loading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await apiLogout()
    } catch (e) {
      console.error('Error during logout:', e)
    }
    setUser(null)
    clearCache()
  }

  return {
    currentUser,
    initialized,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    setUser,
    fetchCurrentUser,
    login,
    logout
  }
})
