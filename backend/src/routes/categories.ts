import { Router, type Router as IRouter } from 'express'
import { fetchAllCategories } from '../services/notion.js'
import type { ApiResponse, Category } from '../types/index.js'

const router: IRouter = Router()

router.get('/', async (_req, res) => {
  try {
    const categories = await fetchAllCategories()
    const response: ApiResponse<Category[]> = {
      success: true,
      data: categories
    }
    res.json(response)
  } catch (error) {
    console.error('Error fetching categories:', error)
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    res.status(500).json(response)
  }
})

export default router
