import { Router, type Router as IRouter } from 'express'
import { fetchAllBookmarks } from '../services/notion.js'
import type { ApiResponse, Bookmark } from '../types/index.js'

const router: IRouter = Router()

router.get('/', async (_req, res) => {
  try {
    const bookmarks = await fetchAllBookmarks()
    const response: ApiResponse<Bookmark[]> = {
      success: true,
      data: bookmarks
    }
    res.json(response)
  } catch (error) {
    console.error('Error fetching bookmarks:', error)
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    res.status(500).json(response)
  }
})

export default router
