import {
  getSettings, saveSettings, normalizeServerUrl, originPattern, fetchMe, syncFromServer, clearCache, AuthError
} from '../lib/data.js'

const input = document.getElementById('server-url')
const statusEl = document.getElementById('status')

const setStatus = (message, kind = '') => {
  statusEl.textContent = message
  statusEl.className = kind
}

const checkConnection = async (serverUrl) => {
  setStatus('Comprobando conexión…')
  try {
    const user = await fetchMe(serverUrl)
    const { bookmarks } = await syncFromServer()
    setStatus(`Conectado como ${user.username}. ${bookmarks.length} bookmarks en caché.`, 'ok')
  } catch (err) {
    if (err instanceof AuthError) {
      setStatus('Servidor accesible, pero sin sesión. Inicia sesión desde el popup o en la web y vuelve a abrir el popup.', 'error')
    } else {
      setStatus(`No se pudo conectar: ${err.message}`, 'error')
    }
  }
}

document.getElementById('form').addEventListener('submit', async (event) => {
  event.preventDefault()
  let serverUrl
  try {
    serverUrl = normalizeServerUrl(input.value)
  } catch {
    setStatus('La URL no es válida', 'error')
    return
  }

  // permissions.request tiene que ir antes de cualquier otro await: necesita el gesto del usuario.
  const granted = await chrome.permissions.request({ origins: [originPattern(serverUrl)] })
  if (!granted) {
    setStatus('Sin el permiso de acceso al servidor la extensión no puede leer tus bookmarks.', 'error')
    return
  }

  const previous = await getSettings()
  if (previous.serverUrl !== serverUrl) await clearCache()
  await saveSettings({ ...previous, serverUrl })
  input.value = serverUrl
  await checkConnection(serverUrl)
})

document.getElementById('clear-cache').addEventListener('click', async () => {
  await clearCache()
  setStatus('Caché vaciada. Se volverá a descargar al abrir el popup.', 'ok')
})

const init = async () => {
  const { serverUrl } = await getSettings()
  if (!serverUrl) return
  input.value = serverUrl
  await checkConnection(serverUrl)
}

init()
