import { nanoid } from 'nanoid'
import db from '../connection.js'
import type { Credential } from '../../types/index.js'

interface CredentialRow {
  id: string
  user_id: string
  type: string
  name: string
  data: string
  created_at: string
  updated_at: string
}

const parseData = (raw: string): Record<string, unknown> => {
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

const rowToCredential = (row: CredentialRow): Credential => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  name: row.name,
  data: parseData(row.data),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const getCredentialsByUser = (userId: string, type?: string): Credential[] => {
  const rows = type !== undefined
    ? db.prepare(`
        SELECT id, user_id, type, name, data, created_at, updated_at
          FROM credentials
         WHERE user_id = ? AND type = ?
         ORDER BY name COLLATE NOCASE
      `).all(userId, type) as CredentialRow[]
    : db.prepare(`
        SELECT id, user_id, type, name, data, created_at, updated_at
          FROM credentials
         WHERE user_id = ?
         ORDER BY type, name COLLATE NOCASE
      `).all(userId) as CredentialRow[]
  return rows.map(rowToCredential)
}

export const getCredentialByIdForUser = (id: string, userId: string): Credential | undefined => {
  const row = db.prepare(`
    SELECT id, user_id, type, name, data, created_at, updated_at
      FROM credentials
     WHERE id = ? AND user_id = ?
  `).get(id, userId) as CredentialRow | undefined
  return row ? rowToCredential(row) : undefined
}

export interface CreateCredentialInput {
  userId: string
  type: string
  name: string
  data: Record<string, unknown>
}

export const createCredential = (input: CreateCredentialInput): Credential => {
  const id = nanoid()
  db.prepare(`
    INSERT INTO credentials (id, user_id, type, name, data)
    VALUES (@id, @userId, @type, @name, @data)
  `).run({
    id,
    userId: input.userId,
    type: input.type,
    name: input.name,
    data: JSON.stringify(input.data)
  })
  return getCredentialByIdForUser(id, input.userId)!
}

export interface UpdateCredentialInput {
  name?: string
  data?: Record<string, unknown>
}

export const updateCredential = (id: string, userId: string, input: UpdateCredentialInput): Credential | undefined => {
  const existing = getCredentialByIdForUser(id, userId)
  if (!existing) return undefined
  const fields: string[] = []
  const params: Record<string, unknown> = { id, userId }
  if (input.name !== undefined) {
    fields.push(`name = @name`)
    params.name = input.name
  }
  if (input.data !== undefined) {
    fields.push(`data = @data`)
    params.data = JSON.stringify(input.data)
  }
  if (fields.length === 0) return existing
  fields.push(`updated_at = datetime('now')`)
  db.prepare(`UPDATE credentials SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`).run(params)
  return getCredentialByIdForUser(id, userId)
}

export const deleteCredential = (id: string, userId: string): boolean => {
  const result = db.prepare(`DELETE FROM credentials WHERE id = ? AND user_id = ?`).run(id, userId)
  return result.changes > 0
}

export interface CredentialUsageBookmark {
  id: string
  name: string
}

export interface CredentialUsage {
  count: number
  bookmarks: CredentialUsageBookmark[]
}

export const getCredentialUsage = (credentialId: string, userId: string, sampleLimit = 3): CredentialUsage => {
  const countRow = db.prepare(`
    SELECT COUNT(DISTINCT b.id) AS n
      FROM widgets w
      JOIN bookmarks b ON b.id = w.bookmark_id
     WHERE b.user_id = ?
       AND json_extract(w.config, '$.credentialId') = ?
  `).get(userId, credentialId) as { n: number }

  if (countRow.n === 0) return { count: 0, bookmarks: [] }

  const rows = db.prepare(`
    SELECT b.id, b.name
      FROM bookmarks b
     WHERE b.user_id = ?
       AND EXISTS (
         SELECT 1 FROM widgets w
          WHERE w.bookmark_id = b.id
            AND json_extract(w.config, '$.credentialId') = ?
       )
     ORDER BY b.name COLLATE NOCASE
     LIMIT ?
  `).all(userId, credentialId, sampleLimit) as Array<{ id: string; name: string }>

  return { count: countRow.n, bookmarks: rows }
}
