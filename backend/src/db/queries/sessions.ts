import { nanoid } from 'nanoid'
import db from '../connection.js'
import type { AuthUser } from '../../types/index.js'

const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

interface SessionLookupRow {
  token: string
  user_id: string
  username: string
  is_admin: number
  expires_at: string
}

const isExpired = (expiresAt: string): boolean => {
  const ts = Date.parse(expiresAt + 'Z')
  if (!Number.isFinite(ts)) return true
  return ts <= Date.now()
}

export const createSession = (userId: string): { token: string; expiresAt: Date } => {
  const token = nanoid(48)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const expiresAtSql = expiresAt.toISOString().replace('T', ' ').slice(0, 19)
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAtSql)
  return { token, expiresAt }
}

export const getSessionUser = (token: string): AuthUser | null => {
  const row = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, u.username, u.is_admin
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as SessionLookupRow | undefined

  if (!row) return null
  if (isExpired(row.expires_at)) {
    deleteSession(token)
    return null
  }
  return {
    id: row.user_id,
    username: row.username,
    isAdmin: row.is_admin === 1
  }
}

export const deleteSession = (token: string): void => {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
}

export const deleteSessionsForUser = (userId: string): void => {
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId)
}

export const purgeExpiredSessions = (): void => {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run()
}

export const sessionTtlMs = (): number => SESSION_TTL_MS
