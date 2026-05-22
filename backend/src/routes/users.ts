import { Router, type Router as IRouter, type Response } from 'express'
import {
  getAllUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  countAdmins
} from '../db/queries/users.js'
import { deleteSessionsForUser } from '../db/queries/sessions.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import type { ApiResponse, User } from '../types/index.js'

const router: IRouter = Router()

router.use(requireAuth, requireAdmin)

const sendError = (res: Response, status: number, message: string) => {
  const response: ApiResponse<null> = { success: false, data: null, error: message }
  res.status(status).json(response)
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,32}$/

router.get('/', (_req, res) => {
  try {
    const users = getAllUsers()
    const response: ApiResponse<User[]> = { success: true, data: users }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.post('/', (req, res) => {
  try {
    const body = req.body as { username?: unknown; password?: unknown; isAdmin?: unknown }
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const isAdmin = body?.isAdmin === true

    if (!USERNAME_RE.test(username)) {
      return sendError(res, 400, 'username debe tener 2-32 caracteres (letras, dígitos, _.-)')
    }
    if (password.length < 4) {
      return sendError(res, 400, 'password debe tener al menos 4 caracteres')
    }
    if (getUserByUsername(username)) {
      return sendError(res, 409, 'username ya existe')
    }

    const user = createUser({ username, password, isAdmin })
    const response: ApiResponse<User> = { success: true, data: user }
    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.put('/:id', (req, res) => {
  try {
    const target = getUserById(req.params.id)
    if (!target) return sendError(res, 404, 'Usuario no encontrado')

    const body = req.body as { password?: unknown; isAdmin?: unknown }
    const patch: { password?: string; isAdmin?: boolean } = {}

    if (body?.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 4) {
        return sendError(res, 400, 'password debe tener al menos 4 caracteres')
      }
      patch.password = body.password
    }
    if (body?.isAdmin !== undefined) {
      if (typeof body.isAdmin !== 'boolean') {
        return sendError(res, 400, 'isAdmin debe ser booleano')
      }
      if (target.isAdmin && !body.isAdmin && countAdmins() <= 1) {
        return sendError(res, 400, 'Debe quedar al menos un administrador')
      }
      patch.isAdmin = body.isAdmin
    }

    const updated = updateUser(req.params.id, patch)
    if (patch.password !== undefined) deleteSessionsForUser(req.params.id)

    const response: ApiResponse<User> = { success: true, data: updated! }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

router.delete('/:id', (req, res) => {
  try {
    const target = getUserById(req.params.id)
    if (!target) return sendError(res, 404, 'Usuario no encontrado')
    if (target.id === req.user!.id) {
      return sendError(res, 400, 'No puedes borrar tu propio usuario')
    }
    if (target.isAdmin && countAdmins() <= 1) {
      return sendError(res, 400, 'Debe quedar al menos un administrador')
    }
    deleteSessionsForUser(target.id)
    deleteUser(target.id)
    const response: ApiResponse<{ id: string }> = { success: true, data: { id: target.id } }
    res.json(response)
  } catch (err) {
    console.error(err)
    sendError(res, 500, err instanceof Error ? err.message : 'Unknown error')
  }
})

export default router
