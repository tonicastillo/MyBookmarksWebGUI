import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import db from '../connection.js'
import type { User } from '../../types/index.js'

interface UserRow {
  id: string
  username: string
  password_hash: string
  is_admin: number
  created_at: string
}

const rowToUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  isAdmin: row.is_admin === 1,
  createdAt: row.created_at
})

export const getAllUsers = (): User[] => {
  const rows = db.prepare(`
    SELECT id, username, password_hash, is_admin, created_at
    FROM users
    ORDER BY username
  `).all() as UserRow[]
  return rows.map(rowToUser)
}

export const getUserById = (id: string): User | undefined => {
  const row = db.prepare(`
    SELECT id, username, password_hash, is_admin, created_at
    FROM users WHERE id = ?
  `).get(id) as UserRow | undefined
  return row ? rowToUser(row) : undefined
}

export const getUserByUsername = (username: string): User | undefined => {
  const row = db.prepare(`
    SELECT id, username, password_hash, is_admin, created_at
    FROM users WHERE username = ?
  `).get(username) as UserRow | undefined
  return row ? rowToUser(row) : undefined
}

export const verifyUserPassword = (username: string, password: string): User | null => {
  const row = db.prepare(`
    SELECT id, username, password_hash, is_admin, created_at
    FROM users WHERE username = ?
  `).get(username) as UserRow | undefined
  if (!row) return null
  if (!bcrypt.compareSync(password, row.password_hash)) return null
  return rowToUser(row)
}

export interface CreateUserInput {
  username: string
  password: string
  isAdmin?: boolean
}

export const createUser = (input: CreateUserInput): User => {
  const id = nanoid()
  const hash = bcrypt.hashSync(input.password, 10)
  db.prepare(`
    INSERT INTO users (id, username, password_hash, is_admin)
    VALUES (?, ?, ?, ?)
  `).run(id, input.username, hash, input.isAdmin ? 1 : 0)
  return getUserById(id)!
}

export interface UpdateUserInput {
  password?: string
  isAdmin?: boolean
}

export const updateUser = (id: string, input: UpdateUserInput): User | undefined => {
  const existing = getUserById(id)
  if (!existing) return undefined
  const fields: string[] = []
  const params: Record<string, unknown> = { id }
  if (input.password !== undefined) {
    fields.push(`password_hash = @password_hash`)
    params.password_hash = bcrypt.hashSync(input.password, 10)
  }
  if (input.isAdmin !== undefined) {
    fields.push(`is_admin = @is_admin`)
    params.is_admin = input.isAdmin ? 1 : 0
  }
  if (fields.length === 0) return existing
  fields.push(`updated_at = datetime('now')`)
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(params)
  return getUserById(id)
}

export const deleteUser = (id: string): boolean => {
  const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(id)
  return result.changes > 0
}

export const countAdmins = (): number => {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE is_admin = 1`).get() as { n: number }
  return row.n
}
