import { Router, type Router as IRouter, type Response } from 'express'
import {
  getWidgetByIdForUser,
  insertWidget,
  updateWidgetConfig,
  deleteWidget,
  reorderWidgets,
  type WidgetInput
} from '../db/queries/widgets.js'
import { getBookmarkById } from '../db/queries/bookmarks.js'
import {
  fetchUnraidContainer,
  runUnraidAction,
  type UnraidActionName,
  type UnraidWidgetConfig
} from '../widgets/unraid.js'
import {
  fetchHomeAssistantStates,
  callHomeAssistantService,
  type HomeAssistantConnection,
  type HomeAssistantEntityConfig,
  type HomeAssistantServiceCall
} from '../widgets/home-assistant.js'
import { getCredentialByIdForUser } from '../db/queries/credentials.js'
import type { ApiResponse, Bookmark, Widget } from '../types/index.js'

const router: IRouter = Router()

const errorLogLastAt = new Map<string, number>()
const ERROR_LOG_THROTTLE_MS = 30_000

const logThrottled = (key: string, message: string) => {
  const now = Date.now()
  const last = errorLogLastAt.get(key) ?? 0
  if (now - last < ERROR_LOG_THROTTLE_MS) return
  errorLogLastAt.set(key, now)
  console.warn(message)
}

const sendError = (res: Response, status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
}

const validateConfig = (value: unknown): Record<string, unknown> => {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('config debe ser un objeto JSON')
  }
  return value as Record<string, unknown>
}

const KNOWN_TYPES = new Set<string>(['hello-world', 'unraid-docker', 'notes', 'home-assistant'])

router.post('/', (req, res) => {
  try {
    const body = req.body as { bookmarkId?: string; type?: string; config?: unknown }
    if (!body?.bookmarkId || typeof body.bookmarkId !== 'string') {
      return sendError(res, 400, 'bookmarkId es obligatorio')
    }
    if (!body.type || typeof body.type !== 'string') {
      return sendError(res, 400, 'type es obligatorio')
    }
    if (!KNOWN_TYPES.has(body.type)) {
      return sendError(res, 400, `Tipo de widget desconocido: ${body.type}`)
    }
    const userId = req.user!.id
    const bookmark = getBookmarkById(body.bookmarkId, userId)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')

    const config = validateConfig(body.config)
    const input: WidgetInput = { bookmarkId: body.bookmarkId, type: body.type, config }
    insertWidget(input)
    const updated = getBookmarkById(body.bookmarkId, userId)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const body = req.body as { config?: unknown }
    const config = validateConfig(body?.config)
    const userId = req.user!.id
    const widget = getWidgetByIdForUser(req.params.id, userId)
    if (!widget) return sendError(res, 404, 'Widget no encontrado')
    updateWidgetConfig(req.params.id, config)
    const updated = getBookmarkById(widget.bookmarkId, userId)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const userId = req.user!.id
    const widget = getWidgetByIdForUser(req.params.id, userId)
    if (!widget) return sendError(res, 404, 'Widget no encontrado')
    deleteWidget(req.params.id)
    const updated = getBookmarkById(widget.bookmarkId, userId)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.post('/reorder', (req, res) => {
  try {
    const body = req.body as { bookmarkId?: string; ids?: unknown }
    if (!body?.bookmarkId || typeof body.bookmarkId !== 'string') {
      return sendError(res, 400, 'bookmarkId es obligatorio')
    }
    if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
      return sendError(res, 400, 'ids debe ser array de strings')
    }
    const userId = req.user!.id
    const bookmark = getBookmarkById(body.bookmarkId, userId)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')
    reorderWidgets(body.bookmarkId, body.ids as string[])
    const updated = getBookmarkById(body.bookmarkId, userId)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

const getUnraidWidgetOrFail = (id: string, userId: string): { widget: Widget; config: UnraidWidgetConfig } | { error: string; status: number } => {
  const widget = getWidgetByIdForUser(id, userId)
  if (!widget) return { error: 'Widget no encontrado', status: 404 }
  if (widget.type !== 'unraid-docker') return { error: 'Widget no es de tipo unraid-docker', status: 400 }
  const cfg = widget.config as { credentialId?: unknown; containerName?: unknown; serverLabel?: unknown }
  const credentialId = typeof cfg.credentialId === 'string' ? cfg.credentialId : ''
  const containerName = typeof cfg.containerName === 'string' ? cfg.containerName : ''
  if (!credentialId) return { error: 'Widget mal configurado: falta credentialId', status: 400 }
  if (!containerName) return { error: 'Widget mal configurado: falta containerName', status: 400 }
  const credential = getCredentialByIdForUser(credentialId, userId)
  if (!credential) return { error: 'Credencial no encontrada', status: 404 }
  if (credential.type !== 'unraid') return { error: 'La credencial no es de tipo unraid', status: 400 }
  const data = credential.data as { serverUrl?: unknown; apiToken?: unknown; serverLabel?: unknown }
  const serverUrl = typeof data.serverUrl === 'string' ? data.serverUrl : ''
  const apiToken = typeof data.apiToken === 'string' ? data.apiToken : ''
  if (!serverUrl || !apiToken) {
    return { error: 'Credencial unraid incompleta: faltan serverUrl o apiToken', status: 400 }
  }
  const serverLabel = typeof cfg.serverLabel === 'string' && cfg.serverLabel
    ? cfg.serverLabel
    : (typeof data.serverLabel === 'string' ? data.serverLabel : '')
  return {
    widget,
    config: { serverUrl, serverLabel, containerName, apiToken }
  }
}

router.get('/:id/unraid/status', async (req, res) => {
  const lookup = getUnraidWidgetOrFail(req.params.id, req.user!.id)
  if ('error' in lookup) return sendError(res, lookup.status, lookup.error)
  try {
    const data = await fetchUnraidContainer(lookup.config)
    const response: ApiResponse<typeof data> = { success: true, data }
    res.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error consultando Unraid'
    logThrottled(`unraid:status:${req.params.id}:${message}`, `[unraid] status error (widget ${req.params.id}): ${message}`)
    sendError(res, 502, message)
  }
})

router.post('/:id/unraid/action', async (req, res) => {
  const lookup = getUnraidWidgetOrFail(req.params.id, req.user!.id)
  if ('error' in lookup) return sendError(res, lookup.status, lookup.error)
  const action = (req.body as { action?: string })?.action
  const VALID: UnraidActionName[] = ['start', 'stop', 'restart']
  if (!action || !VALID.includes(action as UnraidActionName)) {
    return sendError(res, 400, `action debe ser uno de: ${VALID.join(', ')}`)
  }
  try {
    const data = await runUnraidAction(lookup.config, action as UnraidActionName)
    const response: ApiResponse<typeof data> = { success: true, data }
    res.json(response)
  } catch (err) {
    console.error('[unraid] action error:', err)
    sendError(res, 502, err instanceof Error ? err.message : 'Error ejecutando acción')
  }
})

interface HomeAssistantResolvedAction {
  widget: Widget
  conn: HomeAssistantConnection
  entities: HomeAssistantEntityConfig[]
  actions: HomeAssistantServiceCall[][]
}

const parseEntities = (raw: unknown): { entities: HomeAssistantEntityConfig[]; actions: HomeAssistantServiceCall[][] } | null => {
  if (!Array.isArray(raw)) return null
  const entities: HomeAssistantEntityConfig[] = []
  const actions: HomeAssistantServiceCall[][] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const e = item as { entityId?: unknown; label?: unknown; actions?: unknown }
    if (typeof e.entityId !== 'string' || !e.entityId) return null
    entities.push({
      entityId: e.entityId,
      label: typeof e.label === 'string' && e.label ? e.label : undefined
    })
    const rowActions: HomeAssistantServiceCall[] = []
    if (Array.isArray(e.actions)) {
      for (const a of e.actions) {
        if (typeof a !== 'object' || a === null) return null
        const action = a as { domain?: unknown; service?: unknown; serviceData?: unknown; label?: unknown }
        if (typeof action.domain !== 'string' || !action.domain) return null
        if (typeof action.service !== 'string' || !action.service) return null
        const serviceData = action.serviceData
        rowActions.push({
          domain: action.domain,
          service: action.service,
          serviceData: typeof serviceData === 'object' && serviceData !== null && !Array.isArray(serviceData)
            ? serviceData as Record<string, unknown>
            : undefined
        })
      }
    }
    actions.push(rowActions)
  }
  return { entities, actions }
}

const getHomeAssistantWidgetOrFail = (id: string, userId: string): HomeAssistantResolvedAction | { error: string; status: number } => {
  const widget = getWidgetByIdForUser(id, userId)
  if (!widget) return { error: 'Widget no encontrado', status: 404 }
  if (widget.type !== 'home-assistant') return { error: 'Widget no es de tipo home-assistant', status: 400 }
  const cfg = widget.config as { credentialId?: unknown; entities?: unknown }
  const credentialId = typeof cfg.credentialId === 'string' ? cfg.credentialId : ''
  if (!credentialId) return { error: 'Widget mal configurado: falta credentialId', status: 400 }
  const credential = getCredentialByIdForUser(credentialId, userId)
  if (!credential) return { error: 'Credencial no encontrada', status: 404 }
  if (credential.type !== 'homeassistant') return { error: 'La credencial no es de tipo homeassistant', status: 400 }
  const data = credential.data as { baseUrl?: unknown; accessToken?: unknown }
  const baseUrl = typeof data.baseUrl === 'string' ? data.baseUrl : ''
  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : ''
  if (!baseUrl || !accessToken) {
    return { error: 'Credencial homeassistant incompleta: faltan baseUrl o accessToken', status: 400 }
  }
  const parsed = parseEntities(cfg.entities)
  if (!parsed) return { error: 'Widget mal configurado: entities inválido', status: 400 }
  return {
    widget,
    conn: { baseUrl, accessToken },
    entities: parsed.entities,
    actions: parsed.actions
  }
}

router.get('/:id/homeassistant/state', async (req, res) => {
  const lookup = getHomeAssistantWidgetOrFail(req.params.id, req.user!.id)
  if ('error' in lookup) return sendError(res, lookup.status, lookup.error)
  try {
    const data = await fetchHomeAssistantStates(lookup.conn, lookup.entities)
    const response: ApiResponse<typeof data> = { success: true, data }
    res.json(response)
  } catch (err) {
    console.error('[homeassistant] state error:', err)
    sendError(res, 502, err instanceof Error ? err.message : 'Error consultando Home Assistant')
  }
})

router.post('/:id/homeassistant/action', async (req, res) => {
  const lookup = getHomeAssistantWidgetOrFail(req.params.id, req.user!.id)
  if ('error' in lookup) return sendError(res, lookup.status, lookup.error)
  const body = req.body as { entityIndex?: unknown; actionIndex?: unknown }
  const entityIndex = typeof body.entityIndex === 'number' ? body.entityIndex : -1
  const actionIndex = typeof body.actionIndex === 'number' ? body.actionIndex : -1
  if (!Number.isInteger(entityIndex) || entityIndex < 0 || entityIndex >= lookup.entities.length) {
    return sendError(res, 400, 'entityIndex fuera de rango')
  }
  const entityActions = lookup.actions[entityIndex]
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex >= entityActions.length) {
    return sendError(res, 400, 'actionIndex fuera de rango')
  }
  const call = entityActions[actionIndex]
  try {
    await callHomeAssistantService(lookup.conn, call)
    const data = await fetchHomeAssistantStates(lookup.conn, lookup.entities)
    const response: ApiResponse<typeof data> = { success: true, data }
    res.json(response)
  } catch (err) {
    console.error('[homeassistant] action error:', err)
    sendError(res, 502, err instanceof Error ? err.message : 'Error ejecutando acción')
  }
})

export default router
