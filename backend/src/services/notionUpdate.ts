import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_API_KEY
})

export interface ImageS3Update {
  pageId: string
  imageS3?: string
  imageS3Dark?: string
}

/**
 * Actualiza los campos imageS3 e imageS3Dark de un bookmark en Notion
 */
export const updateBookmarkImageS3 = async (
  update: ImageS3Update
): Promise<boolean> => {
  try {
    const properties: Record<string, { url: string | null }> = {}

    if (update.imageS3 !== undefined) {
      properties['imageS3'] = { url: update.imageS3 || null }
    }
    if (update.imageS3Dark !== undefined) {
      properties['imageS3Dark'] = { url: update.imageS3Dark || null }
    }

    if (Object.keys(properties).length === 0) {
      return true
    }

    await notion.pages.update({
      page_id: update.pageId,
      properties
    })

    console.log(`[Notion] Updated imageS3 for page ${update.pageId}`)
    return true
  } catch (error) {
    console.error(`[Notion] Failed to update page ${update.pageId}:`, error)
    return false
  }
}

/**
 * Actualiza múltiples bookmarks con rate limiting
 * Notion API permite ~3 requests/second
 */
export const updateBookmarkImageS3Batch = async (
  updates: ImageS3Update[]
): Promise<{ success: number; failed: number }> => {
  const RATE_LIMIT_DELAY = 350

  let success = 0
  let failed = 0

  for (const update of updates) {
    const result = await updateBookmarkImageS3(update)
    if (result) {
      success++
    } else {
      failed++
    }
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
  }

  return { success, failed }
}
