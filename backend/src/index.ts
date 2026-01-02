import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// IMPORTANTE: Cargar .env ANTES de cualquier otro import que use process.env
dotenv.config({ path: path.join(__dirname, '../../.env') })

// Imports dinámicos para asegurar que process.env ya está cargado
const startServer = async () => {
  const express = (await import('express')).default
  const cors = (await import('cors')).default
  const { default: bookmarksRouter } = await import('./routes/bookmarks.js')
  const { default: categoriesRouter } = await import('./routes/categories.js')

  const app = express()
  const PORT = process.env.PORT || 3003

  app.use(cors())
  app.use(express.json())

  app.use('/api/bookmarks', bookmarksRouter)
  app.use('/api/categories', categoriesRouter)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Servir archivos estáticos del frontend en producción
  if (process.env.NODE_ENV === 'production') {
    // En Docker: __dirname es /app/dist, public está en /app/public
    const staticPath = path.join(__dirname, '../public')
    app.use(express.static(staticPath))

    // SPA fallback - todas las rutas no-API van al index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer().catch(console.error)
