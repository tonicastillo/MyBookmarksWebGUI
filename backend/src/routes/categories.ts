import { Router, type Router as IRouter } from 'express'
import { nanoid } from 'nanoid'
import {
  getAllCategories,
  getCategoryById,
  insertCategory,
  updateCategory,
  deleteCategory,
  type CategoryInput
} from '../db/queries/categories.js'
import type { ApiResponse, Category } from '../types/index.js'

const router: IRouter = Router()

const sendError = (res: Parameters<Parameters<typeof router.get>[1]>[1], status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
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
    const id = nanoid()
    const category = insertCategory(id, input)
    const response: ApiResponse<Category> = { success: true, data: category }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const category = updateCategory(req.params.id, req.body as Partial<CategoryInput>)
    if (!category) return sendError(res, 404, 'Categoría no encontrada')
    const response: ApiResponse<Category> = { success: true, data: category }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
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
