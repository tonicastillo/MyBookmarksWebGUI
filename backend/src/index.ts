import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../../.env') })
}

const startServer = async () => {
  const express = (await import('express')).default
  const cors = (await import('cors')).default
  const cookieParser = (await import('cookie-parser')).default
  const { runMigrations } = await import('./db/migrate.js')
  const { IMAGES_DIR } = await import('./db/connection.js')
  const { default: bookmarksRouter } = await import('./routes/bookmarks.js')
  const { default: categoriesRouter } = await import('./routes/categories.js')
  const { default: widgetsRouter } = await import('./routes/widgets.js')
  const { default: authRouter } = await import('./routes/auth.js')
  const { default: usersRouter } = await import('./routes/users.js')
  const { requireAuth } = await import('./middleware/auth.js')
  const { bookmarkBelongsToUser } = await import('./db/queries/bookmarks.js')
  const { purgeExpiredSessions } = await import('./db/queries/sessions.js')

  runMigrations()
  purgeExpiredSessions()

  const app = express()
  const PORT = process.env.PORT || 3003

  app.use(cors({ origin: true, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)

  app.use('/api/users', usersRouter)
  app.use('/api/bookmarks', requireAuth, bookmarksRouter)
  app.use('/api/categories', requireAuth, categoriesRouter)
  app.use('/api/widgets', requireAuth, widgetsRouter)

  app.get('/images/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(filename)) {
      res.status(400).end()
      return
    }
    const bookmarkId = filename.split('.')[0]
    if (!bookmarkBelongsToUser(bookmarkId, req.user!.id)) {
      res.status(404).end()
      return
    }
    const filepath = path.join(IMAGES_DIR, filename)
    if (!fs.existsSync(filepath)) {
      res.status(404).end()
      return
    }
    res.setHeader('Cache-Control', 'private, max-age=604800')
    res.sendFile(filepath)
  })

  if (process.env.NODE_ENV === 'production') {
    const staticPath = path.join(__dirname, '../public')
    app.use(express.static(staticPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer().catch(console.error)
