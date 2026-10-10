// Datos compartidos entre popup, background y opciones:
// ajustes (URL del servidor), caché en storage.local y llamadas a la API.

const SETTINGS_KEY = 'settings'
const CACHE_KEY = 'cache'

/** Edad a partir de la cual la caché se refresca al abrir el popup u omnibox. */
export const STALE_AFTER_MS = 5 * 60 * 1000

export class AuthError extends Error {}

/** Quita la barra final para poder concatenar rutas (`${serverUrl}/api/...`). */
export const normalizeServerUrl = (raw) => {
  const url = new URL(raw.trim())
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

export const originPattern = (serverUrl) => `${new URL(serverUrl).origin}/*`

export const getSettings = async () => {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  return { serverUrl: '', ...stored[SETTINGS_KEY] }
}

export const saveSettings = async (settings) => {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

/** `{ bookmarks, categories, timestamp, serverUrl }` o null si no hay caché. */
export const getCache = async () => {
  const stored = await chrome.storage.local.get(CACHE_KEY)
  return stored[CACHE_KEY] ?? null
}

export const clearCache = async () => {
  await chrome.storage.local.remove(CACHE_KEY)
}

export const isStale = (cache) => !cache || Date.now() - cache.timestamp > STALE_AFTER_MS

const request = async (serverUrl, path, init = {}) => {
  const response = await fetch(`${serverUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  })
  const body = await response.json().catch(() => null)
  if (response.status === 401) throw new AuthError(body?.error || 'No autenticado')
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Error ${response.status} en ${path}`)
  }
  return body.data
}

export const login = (serverUrl, username, password) =>
  request(serverUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })

export const fetchMe = (serverUrl) => request(serverUrl, '/api/auth/me')

/** Descarga bookmarks y categorías y los guarda en caché. Devuelve la caché nueva. */
export const syncFromServer = async () => {
  const { serverUrl } = await getSettings()
  if (!serverUrl) throw new Error('Configura la URL del servidor en las opciones')

  const [bookmarks, categories] = await Promise.all([
    request(serverUrl, '/api/bookmarks'),
    request(serverUrl, '/api/categories')
  ])
  const cache = { bookmarks, categories, timestamp: Date.now(), serverUrl }
  await chrome.storage.local.set({ [CACHE_KEY]: cache })
  return cache
}

/** Resuelve URLs relativas (`/images/...`) contra el servidor. */
export const resolveUrl = (url, serverUrl) => {
  if (!url) return ''
  try {
    return new URL(url, serverUrl).href
  } catch {
    return ''
  }
}
