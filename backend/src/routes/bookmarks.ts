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

const sendError = (res: Parameters<Parameters<typeof router.get>[1]>[1], status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
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
    const id = nanoid()
    const bookmark = insertBookmark(id, input)
    const response: ApiResponse<Bookmark> = { success: true, data: bookmark }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const bookmark = updateBookmark(req.params.id, req.body as Partial<BookmarkInput>)
    if (!bookmark) return sendError(res, 404, 'Bookmark no encontrado')
    const response: ApiResponse<Bookmark> = { success: true, data: bookmark }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
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
