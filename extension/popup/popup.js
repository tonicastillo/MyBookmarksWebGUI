import {
  getSettings, getCache, isStale, syncFromServer, login, resolveUrl, originPattern, AuthError
} from '../lib/data.js'
import { buildIndex, buildTree, search } from '../lib/search.js'

const $ = (id) => document.getElementById(id)
const queryInput = $('query')
const resultsEl = $('results')
const scopeEl = $('scope')
const bannerEl = $('banner')
const loginForm = $('login')
const statusEl = $('status')
const refreshBtn = $('refresh')

const state = {
  serverUrl: '',
  cache: null,
  index: null,
  tree: [],
  expanded: new Set(), // ids de categorías y mega cards abiertas
  items: [],        // filas renderizadas { node, depth, parent }, en orden de navegación
  active: 0,
  scope: null       // bookmark con searchUrlTemplate en modo «buscar en sitio»
}

// --- Utilidades ----------------------------------------------------------

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const hashHue = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

const timeAgo = (timestamp) => {
  const minutes = Math.round((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}

const hostOf = (url) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const showBanner = (message, action) => {
  bannerEl.replaceChildren(document.createTextNode(message))
  if (action) {
    const button = el('button', null, action.label)
    button.type = 'button'
    button.addEventListener('click', action.onClick)
    bannerEl.append(' · ', button)
  }
  bannerEl.hidden = false
}

const hideBanner = () => { bannerEl.hidden = true }

const showLogin = () => {
  hideBanner()
  $('login-server').textContent = new URL(state.serverUrl).host
  loginForm.hidden = false
  $('username').focus()
}

// --- Abrir enlaces -------------------------------------------------------

/** `new`: pestaña nueva y cierra popup · `background`: pestaña en segundo plano · `current`: pestaña actual. */
const openUrl = async (url, mode) => {
  if (mode === 'current') {
    await chrome.tabs.update({ url })
    window.close()
  } else if (mode === 'background') {
    await chrome.tabs.create({ url, active: false })
  } else {
    await chrome.tabs.create({ url })
    window.close()
  }
}

const modeFromEvent = (event) => {
  if (event.metaKey || event.ctrlKey) return 'background'
  if (event.shiftKey) return 'current'
  return 'new'
}

const scopedSearchUrl = () =>
  state.scope.searchUrlTemplate.replace('{q}', encodeURIComponent(queryInput.value.trim()))

const activate = (event) => {
  if (state.scope) {
    if (queryInput.value.trim()) openUrl(scopedSearchUrl(), modeFromEvent(event))
    return
  }
  const row = state.items[state.active]
  if (!row) return
  if (row.node.type === 'bookmark') openUrl(row.node.entry.url, modeFromEvent(event))
  else toggle(row.node.id)
}

// --- Árbol: expandir / contraer -----------------------------------------

const EXPANDED_KEY = 'expanded'

const saveExpanded = () => {
  chrome.storage.local.set({ [EXPANDED_KEY]: [...state.expanded] })
}

/** Cambia el estado de una carpeta manteniendo la selección sobre ella. */
const setExpanded = (id, expanded) => {
  if (expanded === state.expanded.has(id)) return
  if (expanded) state.expanded.add(id)
  else state.expanded.delete(id)
  saveExpanded()
  render(id)
}

const toggle = (id) => setExpanded(id, !state.expanded.has(id))

/** Aplana el árbol según las carpetas abiertas. Cada fila guarda la posición de su padre. */
const flattenTree = (nodes, depth = 0, parent = -1, rows = []) => {
  nodes.forEach((node) => {
    const position = rows.length
    rows.push({ node, depth, parent })
    if (node.type !== 'bookmark' && state.expanded.has(node.id)) {
      flattenTree(node.children, depth + 1, position, rows)
    }
  })
  return rows
}

// --- Render --------------------------------------------------------------

const renderThumb = (entry) => {
  const letter = el('div', 'thumb letter', (entry.name.trim()[0] || '?').toUpperCase())
  letter.style.background = entry.color || `hsl(${hashHue(entry.id)} 55% 50%)`

  const src = resolveUrl(entry.imageUrl, state.serverUrl)
  if (!src) return letter
  const img = el('img', 'thumb')
  img.src = src
  img.alt = ''
  img.loading = 'lazy'
  img.addEventListener('error', () => img.replaceWith(letter), { once: true })
  return img
}

const indent = (node, depth) => {
  node.style.paddingLeft = `${12 + depth * 18}px`
}

const renderBookmark = (entry, position, depth) => {
  const item = el('a', 'item')
  item.href = entry.url
  item.dataset.position = position
  indent(item, depth)

  const text = el('div', 'text')
  const name = el('div', 'name')
  // En el árbol el padre ya se ve en la jerarquía; solo se muestra al buscar.
  if (state.queryActive && entry.parentName) name.append(el('span', 'parent', `${entry.parentName} › `))
  name.append(entry.name)
  text.append(name)

  const sub = entry.subtitle || (state.queryActive ? entry.categoryName : '') || hostOf(entry.url)
  text.append(el('div', 'sub', sub))

  if (!state.queryActive) item.append(el('span', 'chevron'))
  item.append(renderThumb(entry), text)
  if (entry.searchUrlTemplate) item.append(el('span', 'search-badge', '⇥ buscar'))
  if (entry.valoration) item.append(el('span', 'stars', '★'.repeat(entry.valoration)))

  item.addEventListener('click', (event) => {
    event.preventDefault()
    openUrl(entry.url, modeFromEvent(event))
  })
  item.addEventListener('mousemove', () => setActive(position))
  return item
}

const renderFolder = (node, position, depth) => {
  const open = state.expanded.has(node.id)
  const item = el('div', `item folder ${node.type}`)
  item.dataset.position = position
  item.setAttribute('aria-expanded', String(open))
  indent(item, depth)

  item.append(el('span', 'chevron', open ? '▾' : '▸'))
  if (node.type === 'mega') item.append(renderThumb(node.bookmark))

  const text = el('div', 'text')
  text.append(el('div', 'name', node.name))
  if (node.type === 'mega' && node.bookmark.subtitle) text.append(el('div', 'sub', node.bookmark.subtitle))
  item.append(text, el('span', 'count', String(node.count)))

  item.addEventListener('click', () => {
    setActive(position)
    toggle(node.id)
  })
  item.addEventListener('mousemove', () => setActive(position))
  return item
}

const renderScope = () => {
  const q = queryInput.value.trim()
  const item = el('div', 'item active')
  const text = el('div', 'text')
  text.append(
    el('div', 'name', q ? `Buscar «${q}» en ${state.scope.name}` : `Escribe para buscar en ${state.scope.name}`),
    el('div', 'sub', 'Esc para salir')
  )
  item.append(renderThumb(state.scope), text)
  item.addEventListener('click', activate)
  resultsEl.replaceChildren(item)
}

/** `keepId`: tras expandir/contraer, deja seleccionada la fila de ese nodo. */
const render = (keepId) => {
  if (state.scope) return renderScope()
  if (!state.index) {
    resultsEl.replaceChildren()
    return
  }

  const query = queryInput.value
  state.queryActive = Boolean(query.trim())
  state.items = state.queryActive
    ? search(state.index, query).map((entry) => ({ node: { type: 'bookmark', id: entry.id, entry }, depth: 0, parent: -1 }))
    : flattenTree(state.tree)

  const nodes = state.items.map(({ node, depth }, position) =>
    node.type === 'bookmark' ? renderBookmark(node.entry, position, depth) : renderFolder(node, position, depth)
  )
  if (!nodes.length) nodes.push(el('div', 'empty', state.queryActive ? 'Sin resultados' : 'No hay bookmarks'))
  resultsEl.replaceChildren(...nodes)

  const kept = keepId ? state.items.findIndex((row) => row.node.id === keepId) : -1
  const position = kept >= 0 ? kept : Math.min(state.active, Math.max(state.items.length - 1, 0))
  setActive(position)
}

const setActive = (position) => {
  resultsEl.querySelector('.item.active')?.classList.remove('active')
  state.active = position
  const node = resultsEl.querySelector(`[data-position="${position}"]`)
  if (!node) return
  node.classList.add('active')
  node.scrollIntoView({ block: 'nearest' })
}

const setScope = (entry) => {
  state.scope = entry
  scopeEl.hidden = !entry
  scopeEl.textContent = entry ? entry.name : ''
  queryInput.placeholder = entry ? (entry.searchPlaceholder || `Buscar en ${entry.name}…`) : 'Buscar bookmarks…'
  queryInput.value = ''
  state.active = 0
  render()
}

const applyCache = (cache) => {
  state.cache = cache
  state.index = cache ? buildIndex(cache) : null
  state.tree = state.index ? buildTree(state.index) : []
  statusEl.textContent = cache ? timeAgo(cache.timestamp) : ''
  statusEl.title = cache ? `Última sincronización: ${new Date(cache.timestamp).toLocaleString()}` : ''
  render()
}

// --- Sincronización ------------------------------------------------------

const refresh = async () => {
  refreshBtn.classList.add('spinning')
  try {
    applyCache(await syncFromServer())
    hideBanner()
    loginForm.hidden = true
  } catch (err) {
    if (err instanceof AuthError) {
      if (state.cache) showBanner('Sesión caducada', { label: 'Iniciar sesión', onClick: showLogin })
      else showLogin()
    } else {
      showBanner(state.cache ? `Sin conexión: mostrando caché (${err.message})` : err.message)
    }
  } finally {
    refreshBtn.classList.remove('spinning')
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const errorEl = $('login-error')
  errorEl.hidden = true
  try {
    await login(state.serverUrl, $('username').value.trim(), $('password').value)
    loginForm.hidden = true
    await refresh()
    queryInput.focus()
  } catch (err) {
    errorEl.textContent = err.message
    errorEl.hidden = false
  }
})

// --- Teclado -------------------------------------------------------------

queryInput.addEventListener('input', () => {
  state.active = 0
  render()
})

queryInput.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (state.items.length) setActive((state.active + 1) % state.items.length)
      break
    case 'ArrowUp':
      event.preventDefault()
      if (state.items.length) setActive((state.active - 1 + state.items.length) % state.items.length)
      break
    case 'Enter':
      event.preventDefault()
      activate(event)
      break
    case 'ArrowRight': {
      const row = state.items[state.active]
      if (state.queryActive || !row || row.node.type === 'bookmark' || queryInput.selectionStart < queryInput.value.length) break
      event.preventDefault()
      if (state.expanded.has(row.node.id)) setActive(state.active + 1)
      else setExpanded(row.node.id, true)
      break
    }
    case 'ArrowLeft': {
      const row = state.items[state.active]
      if (state.queryActive || !row || queryInput.value) break
      event.preventDefault()
      if (row.node.type !== 'bookmark' && state.expanded.has(row.node.id)) setExpanded(row.node.id, false)
      else if (row.parent >= 0) setActive(row.parent)
      break
    }
    case 'Tab': {
      const entry = state.items[state.active]?.node.entry
      if (!state.scope && entry?.searchUrlTemplate) {
        event.preventDefault()
        setScope(entry)
      }
      break
    }
    case 'Escape':
      if (state.scope) {
        event.preventDefault()
        setScope(null)
      }
      break
    case 'Backspace':
      if (state.scope && !queryInput.value) setScope(null)
      break
  }
})

refreshBtn.addEventListener('click', refresh)
$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
$('open-app').addEventListener('click', () => state.serverUrl && openUrl(state.serverUrl, 'new'))

// --- Arranque ------------------------------------------------------------

const init = async () => {
  const [settings, cache, stored] = await Promise.all([getSettings(), getCache(), chrome.storage.local.get(EXPANDED_KEY)])
  state.serverUrl = settings.serverUrl
  state.expanded = new Set(stored[EXPANDED_KEY] ?? [])

  if (!state.serverUrl) {
    showBanner('Falta configurar la URL del servidor', {
      label: 'Abrir opciones',
      onClick: () => chrome.runtime.openOptionsPage()
    })
    return
  }

  // La caché de otro servidor no sirve: se ignora hasta sincronizar.
  applyCache(cache?.serverUrl === state.serverUrl ? cache : null)

  const granted = await chrome.permissions.contains({ origins: [originPattern(state.serverUrl)] })
  if (!granted) {
    showBanner('Falta el permiso de acceso al servidor', {
      label: 'Concederlo',
      onClick: () => chrome.runtime.openOptionsPage()
    })
    return
  }

  if (isStale(state.cache)) refresh()
}

init()
