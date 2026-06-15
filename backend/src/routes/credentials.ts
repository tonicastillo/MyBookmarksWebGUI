import { Router, type Router as IRouter, type Response } from 'express'
import {
  getCredentialsByUser,
  getCredentialByIdForUser,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialUsage
} from '../db/queries/credentials.js'
import type { ApiResponse, Credential } from '../types/index.js'

const router: IRouter = Router()

const sendError = (res: Response, status: number, message: string, details?: Record<string, unknown>) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  if (details) response.details = details
  res.status(status).json(response)
}

const KNOWN_TYPES = new Set<string>(['unraid', 'homeassistant', 'synology-nas'])

const validateData = (value: unknown): Record<string, unknown> => {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('data debe ser un objeto JSON')
  }
  return value as Record<string, unknown>
}

router.get('/', (req, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const credentials = getCredentialsByUser(req.user!.id, type)
    const response: ApiResponse<Credential[]> = { success: true, data: credentials }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.post('/', (req, res) => {
  try {
    const body = req.body as { type?: unknown; name?: unknown; data?: unknown }
    const type = typeof body?.type === 'string' ? body.type.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!type) return sendError(res, 400, 'type es obligatorio')
    if (!KNOWN_TYPES.has(type)) return sendError(res, 400, `type desconocido: ${type}`)
    if (!name) return sendError(res, 400, 'name es obligatorio')
    if (name.length > 80) return sendError(res, 400, 'name no puede superar 80 caracteres')
    const data = validateData(body?.data)

    const credential = createCredential({ userId: req.user!.id, type, name, data })
    const response: ApiResponse<Credential> = { success: true, data: credential }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = getCredentialByIdForUser(req.params.id, req.user!.id)
    if (!existing) return sendError(res, 404, 'Credencial no encontrada')

    const body = req.body as { name?: unknown; data?: unknown }
    const patch: { name?: string; data?: Record<string, unknown> } = {}
    if (body?.name !== undefined) {
      if (typeof body.name !== 'string') return sendError(res, 400, 'name debe ser string')
      const trimmed = body.name.trim()
      if (!trimmed) return sendError(res, 400, 'name no puede estar vacío')
      if (trimmed.length > 80) return sendError(res, 400, 'name no puede superar 80 caracteres')
      patch.name = trimmed
    }
    if (body?.data !== undefined) {
      patch.data = validateData(body.data)
    }
    const updated = updateCredential(req.params.id, req.user!.id, patch)
    const response: ApiResponse<Credential> = { success: true, data: updated! }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const existing = getCredentialByIdForUser(req.params.id, req.user!.id)
    if (!existing) return sendError(res, 404, 'Credencial no encontrada')
    const usage = getCredentialUsage(req.params.id, req.user!.id)
    if (usage.count > 0) {
      const word = usage.count === 1 ? 'bookmark' : 'bookmarks'
      return sendError(
        res,
        409,
        `La credencial está en uso por ${usage.count} ${word}. Reasigna o borra los widgets antes de eliminarla.`,
        { bookmarks: usage.bookmarks, count: usage.count }
      )
    }
    deleteCredential(req.params.id, req.user!.id)
    const response: ApiResponse<{ id: string }> = { success: true, data: { id: req.params.id } }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

export default router
