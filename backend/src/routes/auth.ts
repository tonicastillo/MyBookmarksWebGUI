import { Router, type Router as IRouter, type Response } from 'express'
import { verifyUserPassword, getUserById } from '../db/queries/users.js'
import { createSession, deleteSession, sessionTtlMs } from '../db/queries/sessions.js'
import { requireAuth, SESSION_COOKIE } from '../middleware/auth.js'
import type { ApiResponse, AuthUser } from '../types/index.js'

const router: IRouter = Router()

const sendError = (res: Response, status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
}

const setSessionCookie = (res: Response, token: string, expiresAt: Date) => {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    maxAge: sessionTtlMs(),
    path: '/'
  })
}

const clearSessionCookie = (res: Response) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })
}

router.post('/login', (req, res) => {
  try {
    const body = req.body as { username?: unknown; password?: unknown }
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!username || !password) {
      return sendError(res, 400, 'username y password son obligatorios')
    }
    const user = verifyUserPassword(username, password)
    if (!user) {
      return sendError(res, 401, 'Credenciales inválidas')
    }
    const { token, expiresAt } = createSession(user.id)
    setSessionCookie(res, token, expiresAt)
    const authUser: AuthUser = { id: user.id, username: user.username, isAdmin: user.isAdmin }
    const response: ApiResponse<AuthUser> = { success: true, data: authUser }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.post('/logout', (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
  if (token) deleteSession(token)
  clearSessionCookie(res)
  const response: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } }
  res.json(response)
})

router.get('/me', requireAuth, (req, res) => {
  const u = req.user!
  const user = getUserById(u.id)
  if (!user) return sendError(res, 401, 'Sesión inválida')
  const authUser: AuthUser = { id: user.id, username: user.username, isAdmin: user.isAdmin }
  const response: ApiResponse<AuthUser> = { success: true, data: authUser }
  res.json(response)
})

export default router
