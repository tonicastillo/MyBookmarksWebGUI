import db from '../connection.js'
import type { AlternateUrl, Bookmark, Widget } from '../../types/index.js'
import { getAllWidgetsByBookmark, getWidgetsByBookmark } from './widgets.js'

interface BookmarkRow {
  id: string
  name: string
  url: string | null
  subtitle: string | null
  category_id: string | null
  parent_bookmark_id: string | null
  visible_at_start: number
  is_mega_card: number
  color: string | null
  search_placeholder: string | null
  search_url_template: string | null
  image_filename: string | null
  image_url: string | null
  image_scale: number | null
  image_bg_color: string | null
  image_bg_color2: string | null
  resboard: string | null
  alternate_urls: string | null
  valoration: number | null
  updated_at: string | null
}

const cacheBuster = (updatedAt: string | null): string => {
  if (!updatedAt) return ''
  const ts = Date.parse(updatedAt + 'Z')
  return Number.isFinite(ts) ? String(Math.floor(ts / 1000)) : ''
}

const buildImageUrl = (row: BookmarkRow): string | undefined => {
  const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
  if (row.image_filename) {
    const v = cacheBuster(row.updated_at)
    return v
      ? `${base}/images/${row.image_filename}?v=${v}`
      : `${base}/images/${row.image_filename}`
  }
  if (row.image_url) return row.image_url
  return undefined
}

const parseResboard = (raw: string | null): Record<string, unknown> | undefined => {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return undefined
  } catch {
    return undefined
  }
}

const parseAlternateUrls = (raw: string | null): AlternateUrl[] | undefined => {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const list = parsed
      .filter((item): item is { title?: unknown; url?: unknown } =>
        item != null && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title : '',
        url: typeof item.url === 'string' ? item.url : '',
      }))
      .filter((item) => item.url.trim().length > 0)
    return list.length > 0 ? list : undefined
  } catch {
    return undefined
  }
}

const rowToBookmark = (
  row: BookmarkRow,
  tagsByBookmark: Map<string, string[]>,
  widgetsByBookmark: Map<string, Widget[]>
): Bookmark => ({
  id: row.id,
  name: row.name,
  url: row.url ?? '',
  subtitle: row.subtitle ?? undefined,
  tags: tagsByBookmark.get(row.id) ?? [],
  categoryId: row.category_id ?? undefined,
  visibleAtStart: row.visible_at_start === 1,
  isMegaCard: row.is_mega_card === 1,
  imageUrl: buildImageUrl(row),
  parentBookmarkId: row.parent_bookmark_id ?? undefined,
  color: row.color ?? undefined,
  searchPlaceholder: row.search_placeholder ?? undefined,
  searchUrlTemplate: row.search_url_template ?? undefined,
  imageScale: row.image_scale ?? undefined,
  imageBgColor: row.image_bg_color ?? undefined,
  imageBgColor2: row.image_bg_color2 ?? undefined,
  resboard: parseResboard(row.resboard),
  alternateUrls: parseAlternateUrls(row.alternate_urls),
  valoration: row.valoration ?? undefined,
  widgets: widgetsByBookmark.get(row.id) ?? []
})

const loadTagsByBookmark = (userId: string): Map<string, string[]> => {
  const rows = db.prepare(`
    SELECT bt.bookmark_id AS bookmarkId, t.name AS tag
    FROM bookmark_tags bt
    JOIN tags t ON t.id = bt.tag_id
    JOIN bookmarks b ON b.id = bt.bookmark_id
    WHERE b.user_id = ?
  `).all(userId) as Array<{ bookmarkId: string; tag: string }>

  const map = new Map<string, string[]>()
  for (const r of rows) {
    const list = map.get(r.bookmarkId) ?? []
    list.push(r.tag)
    map.set(r.bookmarkId, list)
  }
  return map
}

export const getAllBookmarks = (userId: string): Bookmark[] => {
  const rows = db.prepare(`SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at`).all(userId) as BookmarkRow[]
  const tagsByBookmark = loadTagsByBookmark(userId)
  const widgetsByBookmark = getAllWidgetsByBookmark(userId)
  return rows.map((r) => rowToBookmark(r, tagsByBookmark, widgetsByBookmark))
}

export const getBookmarkById = (id: string, userId: string): Bookmark | undefined => {
  const row = db.prepare(`SELECT * FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId) as BookmarkRow | undefined
  if (!row) return undefined
  const tagsByBookmark = loadTagsByBookmark(userId)
  const widgetsByBookmark = new Map<string, Widget[]>([[id, getWidgetsByBookmark(id)]])
  return rowToBookmark(row, tagsByBookmark, widgetsByBookmark)
}

export const bookmarkBelongsToUser = (id: string, userId: string): boolean => {
  const row = db.prepare(`SELECT 1 AS ok FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId) as { ok: number } | undefined
  return !!row
}

export interface BookmarkInput {
  name: string
  url?: string | null
  subtitle?: string | null
  categoryId?: string | null
  parentBookmarkId?: string | null
  visibleAtStart?: boolean
  isMegaCard?: boolean
  color?: string | null
  searchPlaceholder?: string | null
  searchUrlTemplate?: string | null
  imageUrl?: string | null
  imageScale?: number | null
  imageBgColor?: string | null
  imageBgColor2?: string | null
  tags?: string[]
  resboard?: Record<string, unknown> | null
  alternateUrls?: AlternateUrl[] | null
  valoration?: number | null
}

const serializeResboard = (value: BookmarkInput['resboard']): string | null => {
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

const serializeAlternateUrls = (value: BookmarkInput['alternateUrls']): string | null => {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value) || value.length === 0) return null
  return JSON.stringify(value)
}

const upsertTags = (bookmarkId: string, tags: string[]): void => {
  db.prepare(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`).run(bookmarkId)
  if (tags.length === 0) return

  const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`)
  const getTagId = db.prepare(`SELECT id FROM tags WHERE name = ?`)
  const link = db.prepare(`INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`)

  for (const name of tags) {
    insertTag.run(name)
    const row = getTagId.get(name) as { id: number } | undefined
    if (row) link.run(bookmarkId, row.id)
  }
}

export const insertBookmark = (id: string, input: BookmarkInput, userId: string): Bookmark => {
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO bookmarks (
        id, name, url, subtitle, category_id, parent_bookmark_id,
        visible_at_start, is_mega_card, color,
        search_placeholder, search_url_template, image_url,
        image_scale, image_bg_color, image_bg_color2, resboard,
        alternate_urls, valoration, user_id
      ) VALUES (
        @id, @name, @url, @subtitle, @categoryId, @parentBookmarkId,
        @visibleAtStart, @isMegaCard, @color,
        @searchPlaceholder, @searchUrlTemplate, @imageUrl,
        @imageScale, @imageBgColor, @imageBgColor2, @resboard,
        @alternateUrls, @valoration, @userId
      )
    `).run({
      id,
      name: input.name,
      url: input.url ?? null,
      subtitle: input.subtitle ?? null,
      categoryId: input.categoryId ?? null,
      parentBookmarkId: input.parentBookmarkId ?? null,
      visibleAtStart: input.visibleAtStart ? 1 : 0,
      isMegaCard: input.isMegaCard ? 1 : 0,
      color: input.color ?? null,
      searchPlaceholder: input.searchPlaceholder ?? null,
      searchUrlTemplate: input.searchUrlTemplate ?? null,
      imageUrl: input.imageUrl ?? null,
      imageScale: input.imageScale ?? null,
      imageBgColor: input.imageBgColor ?? null,
      imageBgColor2: input.imageBgColor2 ?? null,
      resboard: serializeResboard(input.resboard),
      alternateUrls: serializeAlternateUrls(input.alternateUrls),
      valoration: input.valoration ?? null,
      userId
    })

    if (input.tags) upsertTags(id, input.tags)
  })
  tx()

  return getBookmarkById(id, userId)!
}

export const updateBookmark = (id: string, input: Partial<BookmarkInput>, userId: string): Bookmark | undefined => {
  const existing = db.prepare(`SELECT id FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId)
  if (!existing) return undefined

  const fields: string[] = []
  const params: Record<string, unknown> = { id, userId }

  const setField = (col: string, key: string, value: unknown) => {
    fields.push(`${col} = @${key}`)
    params[key] = value
  }

  if (input.name !== undefined) setField('name', 'name', input.name)
  if (input.url !== undefined) setField('url', 'url', input.url ?? null)
  if (input.subtitle !== undefined) setField('subtitle', 'subtitle', input.subtitle ?? null)
  if (input.categoryId !== undefined) setField('category_id', 'categoryId', input.categoryId ?? null)
  if (input.parentBookmarkId !== undefined) setField('parent_bookmark_id', 'parentBookmarkId', input.parentBookmarkId ?? null)
  if (input.visibleAtStart !== undefined) setField('visible_at_start', 'visibleAtStart', input.visibleAtStart ? 1 : 0)
  if (input.isMegaCard !== undefined) setField('is_mega_card', 'isMegaCard', input.isMegaCard ? 1 : 0)
  if (input.color !== undefined) setField('color', 'color', input.color ?? null)
  if (input.searchPlaceholder !== undefined) setField('search_placeholder', 'searchPlaceholder', input.searchPlaceholder ?? null)
  if (input.searchUrlTemplate !== undefined) setField('search_url_template', 'searchUrlTemplate', input.searchUrlTemplate ?? null)
  if (input.imageUrl !== undefined) setField('image_url', 'imageUrl', input.imageUrl ?? null)
  if (input.imageScale !== undefined) setField('image_scale', 'imageScale', input.imageScale ?? null)
  if (input.imageBgColor !== undefined) setField('image_bg_color', 'imageBgColor', input.imageBgColor ?? null)
  if (input.imageBgColor2 !== undefined) setField('image_bg_color2', 'imageBgColor2', input.imageBgColor2 ?? null)
  if (input.resboard !== undefined) setField('resboard', 'resboard', serializeResboard(input.resboard))
  if (input.alternateUrls !== undefined) setField('alternate_urls', 'alternateUrls', serializeAlternateUrls(input.alternateUrls))
  if (input.valoration !== undefined) setField('valoration', 'valoration', input.valoration ?? null)

  const tx = db.transaction(() => {
    if (fields.length > 0) {
      fields.push(`updated_at = datetime('now')`)
      db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`).run(params)
    }
    if (input.tags !== undefined) upsertTags(id, input.tags)
  })
  tx()

  return getBookmarkById(id, userId)
}

export const deleteBookmark = (id: string, userId: string): boolean => {
  const result = db.prepare(`DELETE FROM bookmarks WHERE id = ? AND user_id = ?`).run(id, userId)
  return result.changes > 0
}

export const updateImageFilename = (id: string, userId: string, filename: string | null): void => {
  db.prepare(`UPDATE bookmarks SET image_filename = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(filename, id, userId)
}

export const getImageFilename = (id: string, userId: string): string | null => {
  const row = db.prepare(`SELECT image_filename FROM bookmarks WHERE id = ? AND user_id = ?`).get(id, userId) as { image_filename: string | null } | undefined
  return row?.image_filename ?? null
}

export const getImageFilenameAny = (id: string): { filename: string | null; userId: string | null } | null => {
  const row = db.prepare(`SELECT image_filename, user_id FROM bookmarks WHERE id = ?`).get(id) as { image_filename: string | null; user_id: string | null } | undefined
  if (!row) return null
  return { filename: row.image_filename, userId: row.user_id }
}

export const getAllTags = (userId: string): string[] => {
  const rows = db.prepare(`
    SELECT DISTINCT t.name AS name
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    JOIN bookmarks b ON b.id = bt.bookmark_id
    WHERE b.user_id = ?
    ORDER BY t.name
  `).all(userId) as Array<{ name: string }>
  return rows.map((r) => r.name)
}
