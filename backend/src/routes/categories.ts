import { Router, type Router as IRouter } from 'express'
import { nanoid } from 'nanoid'
import {
  getAllCategories,
  getCategoryById,
  insertCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  type CategoryInput,
  type ReorderEntry
} from '../db/queries/categories.js'
import type { ApiResponse, Category } from '../types/index.js'

const router: IRouter = Router()

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

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

router.get('/', (_req, res) => {
  try {
    const categories = getAllCategories()
    const response: ApiResponse<Category[]> = { success: true, data: categories }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/reorder', (req, res) => {
  try {
    const body = req.body
    if (!Array.isArray(body)) return sendError(res, 400, 'Body debe ser array')
    const entries: ReorderEntry[] = body.map((item) => ({
      id: String(item.id),
      order: Number(item.order),
      padreId: item.padreId ?? null
    }))
    const updated = reorderCategories(entries)
    const response: ApiResponse<Category[]> = { success: true, data: updated }
    res.json(response)
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg.startsWith('Ciclo') ? 400 : 500
    sendError(res, status, msg)
  }
})

router.get('/:id', (req, res) => {
  const category = getCategoryById(req.params.id)
  if (!category) return sendError(res, 404, 'Categoría no encontrada')
  const response: ApiResponse<Category> = { success: true, data: category }
  res.json(response)
})

router.post('/', (req, res) => {
  try {
    const input = req.body as CategoryInput
    if (!input?.name || typeof input.name !== 'string') {
      return sendError(res, 400, 'name es obligatorio')
    }
    const color = validateColor(input.color)
    const id = nanoid()
    const category = insertCategory(id, { ...input, color })
    const response: ApiResponse<Category> = { success: true, data: category }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const input = req.body as Partial<CategoryInput>
    const color = validateColor(input.color)
    const patch: Partial<CategoryInput> = { ...input }
    if (color !== undefined) patch.color = color
    const category = updateCategory(req.params.id, patch)
    if (!category) return sendError(res, 404, 'Categoría no encontrada')
    const response: ApiResponse<Category> = { success: true, data: category }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 400, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const ok = deleteCategory(req.params.id)
    if (!ok) return sendError(res, 404, 'Categoría no encontrada')
    const response: ApiResponse<{ id: string }> = { success: true, data: { id: req.params.id } }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

export default router
