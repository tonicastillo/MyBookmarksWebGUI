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
  const rows = db.prepare(`SELECT id, name, "order", padre_id, color FROM categories ORDER BY "order"`).all() as CategoryRow[]
  const hijosByPadre = loadHijosByPadre()
  return rows.map((r) => rowToCategory(r, hijosByPadre))
}

export const getCategoryById = (id: string): Category | undefined => {
  const row = db.prepare(`SELECT id, name, "order", padre_id, color FROM categories WHERE id = ?`).get(id) as CategoryRow | undefined
  if (!row) return undefined
  return rowToCategory(row, loadHijosByPadre())
}

export interface CategoryInput {
  name: string
  order?: number
  padreId?: string | null
  color?: string | null
}

export const insertCategory = (id: string, input: CategoryInput): Category => {
  db.prepare(`
    INSERT INTO categories (id, name, "order", padre_id, color)
    VALUES (@id, @name, @order, @padreId, @color)
  `).run({
    id,
    name: input.name,
    order: input.order ?? 0,
    padreId: input.padreId ?? null,
    color: input.color ?? null
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
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = @id`).run(params)
  }

  return getCategoryById(id)
}

export const deleteCategory = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM categories WHERE id = ?`).run(id)
  return result.changes > 0
}

export interface ReorderEntry {
  id: string
  order: number
  padreId: string | null
}

const validateNoCycles = (entries: ReorderEntry[]): void => {
  const all = db.prepare(`SELECT id, padre_id FROM categories`).all() as Array<{ id: string; padre_id: string | null }>
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

export const reorderCategories = (entries: ReorderEntry[]): Category[] => {
  validateNoCycles(entries)

  const stmt = db.prepare(`
    UPDATE categories
    SET "order" = @order, padre_id = @padreId, updated_at = datetime('now')
    WHERE id = @id
  `)
  const tx = db.transaction((items: ReorderEntry[]) => {
    for (const it of items) stmt.run(it)
  })
  tx(entries)
  return getAllCategories()
}
