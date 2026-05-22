import db from '../connection.js'
import type { Category } from '../../types/index.js'

interface CategoryRow {
  id: string
  name: string
  order: number
  padre_id: string | null
  color: string | null
}

const rowToCategory = (row: CategoryRow, hijosByPadre: Map<string, string[]>): Category => ({
  id: row.id,
  name: row.name,
  order: row.order,
  padreId: row.padre_id ?? undefined,
  color: row.color ?? undefined,
  hijoIds: hijosByPadre.get(row.id) ?? []
})

const loadHijosByPadre = (userId: string): Map<string, string[]> => {
  const rows = db.prepare(`
    SELECT id, padre_id FROM categories WHERE padre_id IS NOT NULL AND user_id = ?
  `).all(userId) as Array<{ id: string; padre_id: string }>

  const map = new Map<string, string[]>()
  for (const r of rows) {
    const list = map.get(r.padre_id) ?? []
    list.push(r.id)
    map.set(r.padre_id, list)
  }
  return map
}

export const getAllCategories = (userId: string): Category[] => {
  const rows = db.prepare(`
    SELECT id, name, "order", padre_id, color
    FROM categories
    WHERE user_id = ?
    ORDER BY "order"
  `).all(userId) as CategoryRow[]
  const hijosByPadre = loadHijosByPadre(userId)
  return rows.map((r) => rowToCategory(r, hijosByPadre))
}

export const getCategoryById = (id: string, userId: string): Category | undefined => {
  const row = db.prepare(`
    SELECT id, name, "order", padre_id, color
    FROM categories
    WHERE id = ? AND user_id = ?
  `).get(id, userId) as CategoryRow | undefined
  if (!row) return undefined
  return rowToCategory(row, loadHijosByPadre(userId))
}

export interface CategoryInput {
  name: string
  order?: number
  padreId?: string | null
  color?: string | null
}

export const insertCategory = (id: string, input: CategoryInput, userId: string): Category => {
  db.prepare(`
    INSERT INTO categories (id, name, "order", padre_id, color, user_id)
    VALUES (@id, @name, @order, @padreId, @color, @userId)
  `).run({
    id,
    name: input.name,
    order: input.order ?? 0,
    padreId: input.padreId ?? null,
    color: input.color ?? null,
    userId
  })
  return getCategoryById(id, userId)!
}

export const updateCategory = (id: string, input: Partial<CategoryInput>, userId: string): Category | undefined => {
  const existing = db.prepare(`SELECT id FROM categories WHERE id = ? AND user_id = ?`).get(id, userId)
  if (!existing) return undefined

  const fields: string[] = []
  const params: Record<string, unknown> = { id, userId }

  if (input.name !== undefined) {
    fields.push(`name = @name`)
    params.name = input.name
  }
  if (input.order !== undefined) {
    fields.push(`"order" = @order`)
    params.order = input.order
  }
  if (input.padreId !== undefined) {
    fields.push(`padre_id = @padreId`)
    params.padreId = input.padreId ?? null
  }
  if (input.color !== undefined) {
    fields.push(`color = @color`)
    params.color = input.color ?? null
  }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`)
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`).run(params)
  }

  return getCategoryById(id, userId)
}

export const deleteCategory = (id: string, userId: string): boolean => {
  const result = db.prepare(`DELETE FROM categories WHERE id = ? AND user_id = ?`).run(id, userId)
  return result.changes > 0
}

export interface ReorderEntry {
  id: string
  order: number
  padreId: string | null
}

const validateNoCycles = (entries: ReorderEntry[], userId: string): void => {
  const all = db.prepare(`SELECT id, padre_id FROM categories WHERE user_id = ?`).all(userId) as Array<{ id: string; padre_id: string | null }>
  const padre = new Map<string, string | null>(all.map((r) => [r.id, r.padre_id]))
  for (const e of entries) padre.set(e.id, e.padreId)

  for (const e of entries) {
    let cursor: string | null = e.padreId
    const seen = new Set<string>()
    while (cursor) {
      if (cursor === e.id) throw new Error(`Ciclo: ${e.id} no puede ser descendiente de sí mismo`)
      if (seen.has(cursor)) throw new Error(`Ciclo detectado en cadena de padres`)
      seen.add(cursor)
      cursor = padre.get(cursor) ?? null
    }
  }
}

export const reorderCategories = (entries: ReorderEntry[], userId: string): Category[] => {
  validateNoCycles(entries, userId)

  const stmt = db.prepare(`
    UPDATE categories
    SET "order" = @order, padre_id = @padreId, updated_at = datetime('now')
    WHERE id = @id AND user_id = @userId
  `)
  const tx = db.transaction((items: ReorderEntry[]) => {
    for (const it of items) stmt.run({ ...it, userId })
  })
  tx(entries)
  return getAllCategories(userId)
}
