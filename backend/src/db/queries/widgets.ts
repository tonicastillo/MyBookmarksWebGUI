import { nanoid } from 'nanoid'
import db from '../connection.js'
import type { Widget } from '../../types/index.js'

interface WidgetRow {
  id: string
  bookmark_id: string
  type: string
  order: number
  config: string
}

const parseConfig = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* fallthrough */
  }
  return {}
}

const rowToWidget = (row: WidgetRow): Widget => ({
  id: row.id,
  bookmarkId: row.bookmark_id,
  type: row.type,
  order: row.order,
  config: parseConfig(row.config)
})

export const getWidgetsByBookmark = (bookmarkId: string): Widget[] => {
  const rows = db.prepare(`
    SELECT id, bookmark_id, type, "order", config
    FROM widgets
    WHERE bookmark_id = ?
    ORDER BY "order", created_at
  `).all(bookmarkId) as WidgetRow[]
  return rows.map(rowToWidget)
}

export const getWidgetById = (id: string): Widget | undefined => {
  const row = db.prepare(`
    SELECT id, bookmark_id, type, "order", config
    FROM widgets WHERE id = ?
  `).get(id) as WidgetRow | undefined
  return row ? rowToWidget(row) : undefined
}

export const getAllWidgetsByBookmark = (): Map<string, Widget[]> => {
  const rows = db.prepare(`
    SELECT id, bookmark_id, type, "order", config
    FROM widgets
    ORDER BY bookmark_id, "order", created_at
  `).all() as WidgetRow[]
  const map = new Map<string, Widget[]>()
  for (const row of rows) {
    const list = map.get(row.bookmark_id) ?? []
    list.push(rowToWidget(row))
    map.set(row.bookmark_id, list)
  }
  return map
}

const nextOrderFor = (bookmarkId: string): number => {
  const row = db.prepare(`
    SELECT COALESCE(MAX("order"), -1) AS maxOrder
    FROM widgets WHERE bookmark_id = ?
  `).get(bookmarkId) as { maxOrder: number }
  return (row?.maxOrder ?? -1) + 1
}

export interface WidgetInput {
  bookmarkId: string
  type: string
  config?: Record<string, unknown>
}

export const insertWidget = (input: WidgetInput): Widget => {
  const id = nanoid()
  const order = nextOrderFor(input.bookmarkId)
  db.prepare(`
    INSERT INTO widgets (id, bookmark_id, type, "order", config)
    VALUES (@id, @bookmarkId, @type, @order, @config)
  `).run({
    id,
    bookmarkId: input.bookmarkId,
    type: input.type,
    order,
    config: JSON.stringify(input.config ?? {})
  })
  return getWidgetById(id)!
}

export const updateWidgetConfig = (id: string, config: Record<string, unknown>): Widget | undefined => {
  const existing = getWidgetById(id)
  if (!existing) return undefined
  db.prepare(`
    UPDATE widgets
       SET config = ?, updated_at = datetime('now')
     WHERE id = ?
  `).run(JSON.stringify(config), id)
  return getWidgetById(id)
}

export const deleteWidget = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM widgets WHERE id = ?`).run(id)
  return result.changes > 0
}

export const reorderWidgets = (bookmarkId: string, ids: string[]): Widget[] => {
  const tx = db.transaction(() => {
    const stmt = db.prepare(`
      UPDATE widgets
         SET "order" = ?, updated_at = datetime('now')
       WHERE id = ? AND bookmark_id = ?
    `)
    ids.forEach((id, index) => {
      stmt.run(index, id, bookmarkId)
    })
  })
  tx()
  return getWidgetsByBookmark(bookmarkId)
}
