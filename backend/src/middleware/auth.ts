import type { Request, Response, NextFunction } from 'express'
import { getSessionUser } from '../db/queries/sessions.js'
import type { ApiResponse } from '../types/index.js'

export const SESSION_COOKIE = 'mb_session'

const unauthorized = (res: Response, message = 'No autenticado') => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(401).json(response)
}

const forbidden = (res: Response, message = 'No autorizado') => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(403).json(response)
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
  if (!token) {
    unauthorized(res)
    return
  }
  const user = getSessionUser(token)
  if (!user) {
    unauthorized(res, 'Sesión inválida o expirada')
    return
  }
  req.user = user
  next()
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    unauthorized(res)
    return
  }
  if (!req.user.isAdmin) {
    forbidden(res, 'Se requiere usuario administrador')
    return
  }
  next()
}
