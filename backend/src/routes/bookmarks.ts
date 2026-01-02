import { Router, type Router as IRouter } from 'express'
import { fetchAllBookmarks } from '../services/notion.js'
import { syncImageToS3, isOurS3Url } from '../services/s3.js'
import { updateBookmarkImageS3Batch, type ImageS3Update } from '../services/notionUpdate.js'
import type { ApiResponse, Bookmark, BookmarkWithOriginalImages } from '../types/index.js'

const router: IRouter = Router()

// Cola de actualizaciones pendientes para Notion
const notionUpdateQueue: ImageS3Update[] = []
let isProcessingQueue = false

/**
 * Procesa la cola de actualizaciones de Notion en background
 */
const processNotionUpdateQueue = async () => {
  if (isProcessingQueue || notionUpdateQueue.length === 0) return

  isProcessingQueue = true

  const updates = [...notionUpdateQueue]
  notionUpdateQueue.length = 0

  console.log(`[Queue] Processing ${updates.length} Notion updates...`)

  const result = await updateBookmarkImageS3Batch(updates)
  console.log(`[Queue] Completed: ${result.success} success, ${result.failed} failed`)

  isProcessingQueue = false

  // Si hay más updates en la cola, procesar
  if (notionUpdateQueue.length > 0) {
    processNotionUpdateQueue().catch(console.error)
  }
}

/**
 * Sincroniza imágenes de bookmarks a S3 en paralelo
 * Maneja tanto imagen clara como oscura
 */
const syncBookmarkImages = async (bookmarks: BookmarkWithOriginalImages[]): Promise<void> => {
  const CONCURRENCY = 5

  // Filtrar bookmarks que tienen imágenes originales por sincronizar
  const bookmarksToSync = bookmarks.filter(b =>
    (b.originalImageUrl && !isOurS3Url(b.imageUrl || '')) ||
    (b.originalImageUrlDark && !isOurS3Url(b.imageUrlDark || ''))
  )

  if (bookmarksToSync.length === 0) {
    return
  }

  console.log(`[Sync] Syncing images for ${bookmarksToSync.length} bookmarks to S3...`)

  for (let i = 0; i < bookmarksToSync.length; i += CONCURRENCY) {
    const batch = bookmarksToSync.slice(i, i + CONCURRENCY)

    await Promise.all(batch.map(async (bookmark) => {
      const update: ImageS3Update = { pageId: bookmark.id }
      let hasChanges = false

      // Sincronizar imagen clara
      if (bookmark.originalImageUrl && !isOurS3Url(bookmark.imageUrl || '')) {
        const s3Url = await syncImageToS3(bookmark.id, bookmark.originalImageUrl)
        if (s3Url) {
          bookmark.imageUrl = s3Url
          update.imageS3 = s3Url
          hasChanges = true
        }
      }

      // Sincronizar imagen oscura
      if (bookmark.originalImageUrlDark && !isOurS3Url(bookmark.imageUrlDark || '')) {
        const s3UrlDark = await syncImageToS3(bookmark.id, bookmark.originalImageUrlDark)
        if (s3UrlDark) {
          bookmark.imageUrlDark = s3UrlDark
          update.imageS3Dark = s3UrlDark
          hasChanges = true
        }
      }

      if (hasChanges) {
        notionUpdateQueue.push(update)
      }
    }))
  }
}

/**
 * Elimina las propiedades internas antes de enviar al cliente
 */
const sanitizeBookmarks = (bookmarks: BookmarkWithOriginalImages[]): Bookmark[] => {
  return bookmarks.map(({ originalImageUrl, originalImageUrlDark, ...bookmark }) => bookmark)
}

router.get('/', async (req, res) => {
  try {
    const syncImages = req.query.syncImages !== 'false'
    const bookmarks = await fetchAllBookmarks()

    if (syncImages) {
      await syncBookmarkImages(bookmarks)

      // Procesar actualizaciones de Notion en background
      if (notionUpdateQueue.length > 0) {
        processNotionUpdateQueue().catch(console.error)
      }
    }

    const response: ApiResponse<Bookmark[]> = {
      success: true,
      data: sanitizeBookmarks(bookmarks)
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
