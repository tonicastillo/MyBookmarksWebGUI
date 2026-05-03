import db from '../connection.js'
import type { Category } from '../../types/index.js'

interface CategoryRow {
  id: string
  name: string
  order: number
  level: number | null
  padre_id: string | null
}

const rowToCategory = (row: CategoryRow, hijosByPadre: Map<string, string[]>): Category => ({
  id: row.id,
  name: row.name,
  order: row.order,
  level: row.level ?? undefined,
  padreId: row.padre_id ?? undefined,
  hijoIds: hijosByPadre.get(row.id) ?? []
})

const loadHijosByPadre = (): Map<string, string[]> => {
  const rows = db.prepare(`
    SELECT id, padre_id FROM categories WHERE padre_id IS NOT NULL
  `).all() as Array<{ id: string; padre_id: string }>

  const map = new Map<string, string[]>()
  for (const r of rows) {
    const list = map.get(r.padre_id) ?? []
    list.push(r.id)
    map.set(r.padre_id, list)
  }
  return map
}

export const getAllCategories = (): Category[] => {
  const rows = db.prepare(`SELECT id, name, "order", level, padre_id FROM categories ORDER BY "order"`).all() as CategoryRow[]
  const hijosByPadre = loadHijosByPadre()
  return rows.map((r) => rowToCategory(r, hijosByPadre))
}

export const getCategoryById = (id: string): Category | undefined => {
  const row = db.prepare(`SELECT id, name, "order", level, padre_id FROM categories WHERE id = ?`).get(id) as CategoryRow | undefined
  if (!row) return undefined
  return rowToCategory(row, loadHijosByPadre())
}

export interface CategoryInput {
  name: string
  order?: number
  level?: number | null
  padreId?: string | null
}

export const insertCategory = (id: string, input: CategoryInput): Category => {
  db.prepare(`
    INSERT INTO categories (id, name, "order", level, padre_id)
    VALUES (@id, @name, @order, @level, @padreId)
  `).run({
    id,
    name: input.name,
    order: input.order ?? 0,
    level: input.level ?? null,
    padreId: input.padreId ?? null
  })
  return getCategoryById(id)!
}

export const updateCategory = (id: string, input: Partial<CategoryInput>): Category | undefined => {
  const existing = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(id)
  if (!existing) return undefined

  const fields: string[] = []
  const params: Record<string, unknown> = { id }

  if (input.name !== undefined) {
    fields.push(`name = @name`)
    params.name = input.name
  }
  if (input.order !== undefined) {
    fields.push(`"order" = @order`)
    params.order = input.order
  }
  if (input.level !== undefined) {
    fields.push(`level = @level`)
    params.level = input.level ?? null
  }
  if (input.padreId !== undefined) {
    fields.push(`padre_id = @padreId`)
    params.padreId = input.padreId ?? null
  }

  if (fields.length > 0) {
    fields.push(`updated_at = datetime('now')`)
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = @id`).run(params)
  }

  return getCategoryById(id)
}

export const deleteCategory = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM categories WHERE id = ?`).run(id)
  return result.changes > 0
}
