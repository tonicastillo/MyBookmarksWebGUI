import { Router, type Router as IRouter } from 'express'
import {
  getWidgetById,
  getWidgetsByBookmark,
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
import type { ApiResponse, Bookmark, Widget } from '../types/index.js'

const router: IRouter = Router()

const sendError = (res: Parameters<Parameters<typeof router.get>[1]>[1], status: number, message: string) => {
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

const KNOWN_TYPES = new Set<string>(['hello-world', 'unraid-docker'])

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
    const bookmark = getBookmarkById(body.bookmarkId)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')

    const config = validateConfig(body.config)
    const input: WidgetInput = { bookmarkId: body.bookmarkId, type: body.type, config }
    insertWidget(input)
    const updated = getBookmarkById(body.bookmarkId)!
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
    const widget = getWidgetById(req.params.id)
    if (!widget) return sendError(res, 404, 'Widget no encontrado')
    updateWidgetConfig(req.params.id, config)
    const updated = getBookmarkById(widget.bookmarkId)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const widget = getWidgetById(req.params.id)
    if (!widget) return sendError(res, 404, 'Widget no encontrado')
    deleteWidget(req.params.id)
    const updated = getBookmarkById(widget.bookmarkId)!
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
    reorderWidgets(body.bookmarkId, body.ids as string[])
    const updated = getBookmarkById(body.bookmarkId)
    if (!updated) return sendError(res, 404, 'Bookmark no encontrado')
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

const getUnraidWidgetOrFail = (id: string): { widget: Widget; config: UnraidWidgetConfig } | { error: string; status: number } => {
  const widget = getWidgetById(id)
  if (!widget) return { error: 'Widget no encontrado', status: 404 }
  if (widget.type !== 'unraid-docker') return { error: 'Widget no es de tipo unraid-docker', status: 400 }
  const cfg = widget.config as Partial<UnraidWidgetConfig>
  if (!cfg.serverUrl || !cfg.containerName || !cfg.apiToken) {
    return { error: 'Widget mal configurado: faltan serverUrl, containerName o apiToken', status: 400 }
  }
  return { widget, config: cfg as UnraidWidgetConfig }
}

router.get('/:id/unraid/status', async (req, res) => {
  const lookup = getUnraidWidgetOrFail(req.params.id)
  if ('error' in lookup) return sendError(res, lookup.status, lookup.error)
  try {
    const data = await fetchUnraidContainer(lookup.config)
    const response: ApiResponse<typeof data> = { success: true, data }
    res.json(response)
  } catch (err) {
    console.error('[unraid] status error:', err)
    sendError(res, 502, err instanceof Error ? err.message : 'Error consultando Unraid')
  }
})

router.post('/:id/unraid/action', async (req, res) => {
  const lookup = getUnraidWidgetOrFail(req.params.id)
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

export default router
