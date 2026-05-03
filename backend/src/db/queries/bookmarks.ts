import db from '../connection.js'
import type { Bookmark } from '../../types/index.js'

interface BookmarkRow {
  id: string
  name: string
  url: string | null
  alternate_url: string | null
  subtitle: string | null
  category_id: string | null
  parent_bookmark_id: string | null
  visible_at_start: number
  status: string
  valoration: string | null
  color_hue: number | null
  search_placeholder: string | null
  search_url_template: string | null
  image_filename: string | null
  image_url: string | null
  created_at: string
}

const buildImageUrl = (row: BookmarkRow): string | undefined => {
  const base = process.env.PUBLIC_BASE_URL ?? ''
  if (row.image_filename) return `${base}/images/${row.image_filename}`
  if (row.image_url) return row.image_url
  return undefined
}

const rowToBookmark = (row: BookmarkRow, tagsByBookmark: Map<string, string[]>): Bookmark => ({
  id: row.id,
  name: row.name,
  url: row.url ?? '',
  alternateUrl: row.alternate_url ?? undefined,
  subtitle: row.subtitle ?? undefined,
  tags: tagsByBookmark.get(row.id) ?? [],
  categoryId: row.category_id ?? undefined,
  visibleAtStart: row.visible_at_start === 1,
  status: row.status as Bookmark['status'],
  valoration: row.valoration as Bookmark['valoration'] | undefined ?? undefined,
  imageUrl: buildImageUrl(row),
  createdTime: row.created_at,
  parentBookmarkId: row.parent_bookmark_id ?? undefined,
  colorHue: row.color_hue ?? undefined,
  searchPlaceholder: row.search_placeholder ?? undefined,
  searchUrlTemplate: row.search_url_template ?? undefined
})

const loadTagsByBookmark = (): Map<string, string[]> => {
  const rows = db.prepare(`
    SELECT bt.bookmark_id AS bookmarkId, t.name AS tag
    FROM bookmark_tags bt
    JOIN tags t ON t.id = bt.tag_id
  `).all() as Array<{ bookmarkId: string; tag: string }>

  const map = new Map<string, string[]>()
  for (const r of rows) {
    const list = map.get(r.bookmarkId) ?? []
    list.push(r.tag)
    map.set(r.bookmarkId, list)
  }
  return map
}

export const getAllBookmarks = (): Bookmark[] => {
  const rows = db.prepare(`SELECT * FROM bookmarks ORDER BY created_at`).all() as BookmarkRow[]
  const tagsByBookmark = loadTagsByBookmark()
  return rows.map((r) => rowToBookmark(r, tagsByBookmark))
}

export const getBookmarkById = (id: string): Bookmark | undefined => {
  const row = db.prepare(`SELECT * FROM bookmarks WHERE id = ?`).get(id) as BookmarkRow | undefined
  if (!row) return undefined
  const tagsByBookmark = loadTagsByBookmark()
  return rowToBookmark(row, tagsByBookmark)
}

export interface BookmarkInput {
  name: string
  url?: string | null
  alternateUrl?: string | null
  subtitle?: string | null
  categoryId?: string | null
  parentBookmarkId?: string | null
  visibleAtStart?: boolean
  status?: Bookmark['status']
  valoration?: string | null
  colorHue?: number | null
  searchPlaceholder?: string | null
  searchUrlTemplate?: string | null
  imageUrl?: string | null
  tags?: string[]
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

export const insertBookmark = (id: string, input: BookmarkInput): Bookmark => {
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO bookmarks (
        id, name, url, alternate_url, subtitle, category_id, parent_bookmark_id,
        visible_at_start, status, valoration, color_hue,
        search_placeholder, search_url_template, image_url
      ) VALUES (
        @id, @name, @url, @alternateUrl, @subtitle, @categoryId, @parentBookmarkId,
        @visibleAtStart, @status, @valoration, @colorHue,
        @searchPlaceholder, @searchUrlTemplate, @imageUrl
      )
    `).run({
      id,
      name: input.name,
      url: input.url ?? null,
      alternateUrl: input.alternateUrl ?? null,
      subtitle: input.subtitle ?? null,
      categoryId: input.categoryId ?? null,
      parentBookmarkId: input.parentBookmarkId ?? null,
      visibleAtStart: input.visibleAtStart ? 1 : 0,
      status: input.status ?? 'Not started',
      valoration: input.valoration ?? null,
      colorHue: input.colorHue ?? null,
      searchPlaceholder: input.searchPlaceholder ?? null,
      searchUrlTemplate: input.searchUrlTemplate ?? null,
      imageUrl: input.imageUrl ?? null
    })

    if (input.tags) upsertTags(id, input.tags)
  })
  tx()

  return getBookmarkById(id)!
}

export const updateBookmark = (id: string, input: Partial<BookmarkInput>): Bookmark | undefined => {
  const existing = db.prepare(`SELECT id FROM bookmarks WHERE id = ?`).get(id)
  if (!existing) return undefined

  const fields: string[] = []
  const params: Record<string, unknown> = { id }

  const setField = (col: string, key: string, value: unknown) => {
    fields.push(`${col} = @${key}`)
    params[key] = value
  }

  if (input.name !== undefined) setField('name', 'name', input.name)
  if (input.url !== undefined) setField('url', 'url', input.url ?? null)
  if (input.alternateUrl !== undefined) setField('alternate_url', 'alternateUrl', input.alternateUrl ?? null)
  if (input.subtitle !== undefined) setField('subtitle', 'subtitle', input.subtitle ?? null)
  if (input.categoryId !== undefined) setField('category_id', 'categoryId', input.categoryId ?? null)
  if (input.parentBookmarkId !== undefined) setField('parent_bookmark_id', 'parentBookmarkId', input.parentBookmarkId ?? null)
  if (input.visibleAtStart !== undefined) setField('visible_at_start', 'visibleAtStart', input.visibleAtStart ? 1 : 0)
  if (input.status !== undefined) setField('status', 'status', input.status)
  if (input.valoration !== undefined) setField('valoration', 'valoration', input.valoration ?? null)
  if (input.colorHue !== undefined) setField('color_hue', 'colorHue', input.colorHue ?? null)
  if (input.searchPlaceholder !== undefined) setField('search_placeholder', 'searchPlaceholder', input.searchPlaceholder ?? null)
  if (input.searchUrlTemplate !== undefined) setField('search_url_template', 'searchUrlTemplate', input.searchUrlTemplate ?? null)
  if (input.imageUrl !== undefined) setField('image_url', 'imageUrl', input.imageUrl ?? null)

  const tx = db.transaction(() => {
    if (fields.length > 0) {
      fields.push(`updated_at = datetime('now')`)
      db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = @id`).run(params)
    }
    if (input.tags !== undefined) upsertTags(id, input.tags)
  })
  tx()

  return getBookmarkById(id)
}

export const deleteBookmark = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(id)
  return result.changes > 0
}

export const updateImageFilename = (id: string, filename: string | null): void => {
  db.prepare(`UPDATE bookmarks SET image_filename = ?, updated_at = datetime('now') WHERE id = ?`).run(filename, id)
}

export const getImageFilename = (id: string): string | null => {
  const row = db.prepare(`SELECT image_filename FROM bookmarks WHERE id = ?`).get(id) as { image_filename: string | null } | undefined
  return row?.image_filename ?? null
}

export const getAllTags = (): string[] => {
  const rows = db.prepare(`SELECT name FROM tags ORDER BY name`).all() as Array<{ name: string }>
  return rows.map((r) => r.name)
}
