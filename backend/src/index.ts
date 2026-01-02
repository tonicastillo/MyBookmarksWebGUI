import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import bookmarksRouter from './routes/bookmarks.js'
import categoriesRouter from './routes/categories.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar .env desde la raíz del proyecto (tanto en desarrollo como en producción local)
dotenv.config({ path: path.join(__dirname, '../../.env') })

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
  const staticPath = path.join(__dirname, '../../public')
  app.use(express.static(staticPath))

  // SPA fallback - todas las rutas no-API van al index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
