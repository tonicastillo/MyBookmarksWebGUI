import { Router, type Router as IRouter } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { IMAGES_DIR } from '../db/connection.js'
import {
  getAllBookmarks,
  getBookmarkById,
  insertBookmark,
  updateBookmark,
  deleteBookmark,
  updateImageFilename,
  getImageFilename,
  getAllTags,
  type BookmarkInput
} from '../db/queries/bookmarks.js'
import type { ApiResponse, Bookmark } from '../types/index.js'

const router: IRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/avif': 'avif'
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))$/

const sendError = (res: Parameters<Parameters<typeof router.get>[1]>[1], status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
}

const validateColor = (color: unknown): string | null | undefined => {
  if (color === undefined) return undefined
  if (color === null) return null
  if (typeof color === 'string' && HEX_COLOR_RE.test(color)) return color
  throw new Error('color debe ser hex #rrggbb o null')
}

const validateBgColor = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value === 'string' && CSS_COLOR_RE.test(value.trim())) return value.trim()
  throw new Error('color de fondo debe ser hex, rgb(a) o hsl(a)')
}

const validateScale = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('image_scale debe ser numérico')
  }
  if (value < 0.5 || value > 1) {
    throw new Error('image_scale debe estar entre 0.5 y 1')
  }
  return value
}

const validateResboard = (value: unknown): Record<string, unknown> | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('resboard debe ser un objeto JSON o null')
  }
  return value as Record<string, unknown>
}

const sanitizeBookmarkInput = (input: BookmarkInput): BookmarkInput => {
  const color = validateColor(input.color)
  const resboard = validateResboard(input.resboard)
  const imageScale = validateScale(input.imageScale)
  const imageBgColor = validateBgColor(input.imageBgColor)
  const imageBgColor2 = validateBgColor(input.imageBgColor2)
  const patch: BookmarkInput = { ...input }
  if (color !== undefined) patch.color = color
  if (resboard !== undefined) patch.resboard = resboard
  if (imageScale !== undefined) patch.imageScale = imageScale
  if (imageBgColor !== undefined) patch.imageBgColor = imageBgColor
  if (imageBgColor2 !== undefined) patch.imageBgColor2 = imageBgColor2
  if (patch.isMegaCard === true) patch.parentBookmarkId = null
  return patch
}

router.get('/', (_req, res) => {
  try {
    const bookmarks = getAllBookmarks()
    const response: ApiResponse<Bookmark[]> = { success: true, data: bookmarks }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.get('/tags', (_req, res) => {
  try {
    const response: ApiResponse<string[]> = { success: true, data: getAllTags() }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.get('/:id', (req, res) => {
  const bookmark = getBookmarkById(req.params.id)
  if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')
  const response: ApiResponse<Bookmark> = { success: true, data: bookmark }
  res.json(response)
})

router.post('/', (req, res) => {
  try {
    const input = req.body as BookmarkInput
    if (!input?.name || typeof input.name !== 'string') {
      return sendError(res, 400, 'name es obligatorio')
    }
    const sanitized = sanitizeBookmarkInput(input)
    const id = nanoid()
    const bookmark = insertBookmark(id, sanitized)
    const response: ApiResponse<Bookmark> = { success: true, data: bookmark }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const sanitized = sanitizeBookmarkInput(req.body as BookmarkInput)
    const bookmark = updateBookmark(req.params.id, sanitized)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')
    const response: ApiResponse<Bookmark> = { success: true, data: bookmark }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const filename = getImageFilename(req.params.id)
    const ok = deleteBookmark(req.params.id)
    if (!ok) return sendError(res, 404, 'Bookmark no encontrado')
    if (filename) {
      const filepath = path.join(IMAGES_DIR, filename)
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    }
    const response: ApiResponse<{ id: string }> = { success: true, data: { id: req.params.id } }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.post('/:id/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return sendError(res, 400, 'No se ha subido ningún archivo')

    const ext = ALLOWED_MIME[req.file.mimetype]
    if (!ext) return sendError(res, 400, `Mime no soportado: ${req.file.mimetype}`)

    const bookmark = getBookmarkById(req.params.id)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')

    const previous = getImageFilename(req.params.id)
    const filename = `${req.params.id}.${ext}`
    fs.writeFileSync(path.join(IMAGES_DIR, filename), req.file.buffer)

    if (previous && previous !== filename) {
      const oldPath = path.join(IMAGES_DIR, previous)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    updateImageFilename(req.params.id, filename)
    const updated = getBookmarkById(req.params.id)!
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id/image', (req, res) => {
  try {
    const filename = getImageFilename(req.params.id)
    if (filename) {
      const filepath = path.join(IMAGES_DIR, filename)
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      updateImageFilename(req.params.id, null)
    }
    const updated = getBookmarkById(req.params.id)
    if (!updated) return sendError(res, 404, 'Bookmark no encontrado')
    const response: ApiResponse<Bookmark> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

export default router
