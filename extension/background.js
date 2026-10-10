// Service worker (Chrome) / background script (Firefox):
// refresco periódico de la caché y sugerencias en la barra de direcciones (`bm <texto>`).
import { getCache, isStale, syncFromServer, AuthError } from './lib/data.js'
import { buildIndex, search } from './lib/search.js'

const SYNC_ALARM = 'sync'
const SYNC_PERIOD_MINUTES = 30
// Firefox no interpreta marcado XML en las sugerencias del omnibox; Chrome lo exige escapado.
const IS_FIREFOX = typeof browser !== 'undefined'

const sync = async () => {
  try {
    return await syncFromServer()
  } catch (err) {
    if (!(err instanceof AuthError)) console.warn('[MyBookmarks] sync:', err.message)
    return null
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES })
  if (reason === 'install') chrome.runtime.openOptionsPage()
  else sync()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES })
  sync()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) sync()
})

// --- Omnibox -------------------------------------------------------------

let cachedIndex = null
let cachedTimestamp = 0

const getIndex = async () => {
  const cache = await getCache()
  if (!cache) return null
  if (isStale(cache)) sync()
  if (cache.timestamp !== cachedTimestamp) {
    cachedIndex = buildIndex(cache)
    cachedTimestamp = cache.timestamp
  }
  return cachedIndex
}

const escapeXml = (str) =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

const describe = (entry) => {
  const title = entry.parentName ? `${entry.parentName} › ${entry.name}` : entry.name
  if (IS_FIREFOX) return `${title} — ${entry.url}`
  return `<match>${escapeXml(title)}</match> <dim>${escapeXml(entry.subtitle || entry.categoryName || '')}</dim> <url>${escapeXml(entry.url)}</url>`
}

chrome.omnibox.setDefaultSuggestion({ description: 'Buscar en MyBookmarks' })

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const index = await getIndex()
  if (!index) return
  suggest(search(index, text, 8).map((entry) => ({ content: entry.url, description: describe(entry) })))
})

const DISPOSITION_TO_ACTION = {
  currentTab: (url) => chrome.tabs.update({ url }),
  newForegroundTab: (url) => chrome.tabs.create({ url }),
  newBackgroundTab: (url) => chrome.tabs.create({ url, active: false })
}

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let url = /^https?:\/\//.test(text) ? text : null
  if (!url) {
    const index = await getIndex()
    url = index ? search(index, text, 1)[0]?.url : null
  }
  if (url) DISPOSITION_TO_ACTION[disposition]?.(url)
})
