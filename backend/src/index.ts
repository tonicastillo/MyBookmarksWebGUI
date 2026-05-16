import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../../.env') })
}

const startServer = async () => {
  const express = (await import('express')).default
  const cors = (await import('cors')).default
  const { runMigrations } = await import('./db/migrate.js')
  const { IMAGES_DIR } = await import('./db/connection.js')
  const { default: bookmarksRouter } = await import('./routes/bookmarks.js')
  const { default: categoriesRouter } = await import('./routes/categories.js')
  const { default: widgetsRouter } = await import('./routes/widgets.js')

  runMigrations()

  const app = express()
  const PORT = process.env.PORT || 3003

  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.use('/images', express.static(IMAGES_DIR, { maxAge: '7d' }))
  app.use('/api/bookmarks', bookmarksRouter)
  app.use('/api/categories', categoriesRouter)
  app.use('/api/widgets', widgetsRouter)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
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
