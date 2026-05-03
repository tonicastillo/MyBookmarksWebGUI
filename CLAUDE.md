# MyBookmarks2026

Aplicación Vue para gestionar y visualizar bookmarks personales. Almacenamiento 100% local — sin Notion ni servicios externos.

## Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vue Frontend  │ ──► │  Backend (API)   │ ──► │  SQLite local   │
│   (SPA + Cache) │ ◄── │  Express + CRUD  │ ◄── │  + data/images/ │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Frontend (Vue 3 + TypeScript)
- SPA con Vue 3 Composition API
- Pinia para estado, caché localStorage para arranque rápido (TTL 24h)
- Búsqueda y filtrado en cliente
- Vistas: `/` (home), `/edit/:id?` (crear/editar bookmark), `/categories` (gestionar categorías)

### Backend (Node.js + Express + better-sqlite3)
- API REST contra SQLite local
- Sirve imágenes estáticas desde `backend/data/images/` en `/images/{filename}`
- Sin dependencias de red en runtime — la app funciona sin internet

## Base de datos local

- **Fichero**: `backend/data/bookmarks.db` (SQLite, modo WAL)
- **Imágenes subidas**: `backend/data/images/{bookmarkId}.{ext}`
- **Esquema**: definido inline en `backend/src/db/migrate.ts` (se aplica al arrancar el servidor; usa `CREATE TABLE IF NOT EXISTS`).
- **Backup**: copiar `backend/data/bookmarks.db` y la carpeta `backend/data/images/`. Eso es todo.
- **Inspección manual**: TablePlus, DB Browser for SQLite o `sqlite3 backend/data/bookmarks.db`.

### Tablas

- `categories(id, name, "order", level, padre_id)`
- `bookmarks(id, name, url, alternate_url, subtitle, category_id, parent_bookmark_id, visible_at_start, status, valoration, color_hue, search_placeholder, search_url_template, image_filename, image_url, created_at, updated_at)`
- `tags(id, name)` + `bookmark_tags(bookmark_id, tag_id)` (pivot)
- `bookmarks_fts` virtual (FTS5, sin uso aún — la búsqueda sigue siendo cliente)

Los IDs de bookmarks/categorías importados de Notion son los UUID originales. Los creados desde la app usan `nanoid()`.

## Modelo de Datos

### Bookmark
```typescript
interface Bookmark {
  id: string
  name: string
  url: string                       // vacío si es padre de mega card
  alternateUrl?: string
  subtitle?: string
  tags: string[]
  categoryId?: string
  visibleAtStart: boolean
  status: 'Not started' | 'In progress' | 'Done'
  valoration?: string               // p. ej. '⭐⭐⭐'
  imageUrl?: string                 // URL servida por backend (/images/...) o externa
  createdTime: string
  parentBookmarkId?: string         // mega card: padre del grupo
  colorHue?: number                 // 0–360, override del color de acento
  searchPlaceholder?: string
  searchUrlTemplate?: string        // con {q}
}
```

### Category
```typescript
interface Category {
  id: string
  name: string
  order: number
  level?: number
  padreId?: string
  hijoIds?: string[]
}
```

### Mega cards
1. Crea un bookmark "padre" con imagen y subtítulo. **Deja `url` vacío** y `visibleAtStart = true`.
2. En cada bookmark hijo, asigna `parentBookmarkId` al padre. Los hijos heredan visibilidad del padre.
3. (Opcional) Búsqueda interna: rellena `searchPlaceholder` y `searchUrlTemplate` (con `{q}`).

## API

| Método | Ruta                              | Descripción                                  |
|--------|-----------------------------------|----------------------------------------------|
| GET    | `/api/bookmarks`                  | Lista todos los bookmarks                    |
| GET    | `/api/bookmarks/:id`              | Un bookmark                                  |
| POST   | `/api/bookmarks`                  | Crear bookmark                               |
| PUT    | `/api/bookmarks/:id`              | Actualizar (parcial)                         |
| DELETE | `/api/bookmarks/:id`              | Borrar bookmark + imagen local si existe     |
| POST   | `/api/bookmarks/:id/image`        | Upload multipart (campo `image`)             |
| DELETE | `/api/bookmarks/:id/image`        | Borrar imagen local                          |
| GET    | `/api/bookmarks/tags`             | Lista de nombres de tags conocidos           |
| GET    | `/api/categories`                 | Lista todas las categorías                   |
| GET    | `/api/categories/:id`             | Una categoría                                |
| POST   | `/api/categories`                 | Crear categoría                              |
| PUT    | `/api/categories/:id`             | Actualizar (parcial)                         |
| DELETE | `/api/categories/:id`             | Borrar categoría                             |
| GET    | `/images/:filename`               | Imagen estática (desde `backend/data/images/`) |
| GET    | `/api/health`                     | Status check                                 |

Todas las respuestas JSON usan `{ success, data, error? }` (`ApiResponse<T>`).

## Reglas de Negocio

### Vista Principal (Home)
1. **Estado inicial (sin filtros)**: solo bookmarks con `visibleAtStart: true`, agrupados por categoría y ordenados por `category.order`.
2. **Con búsqueda activa**: TODOS los bookmarks que coincidan (ignora `visibleAtStart`).
3. **Con etiquetas activas**: TODOS los bookmarks con esas etiquetas (ignora `visibleAtStart`).
4. **Búsqueda**: por nombre, subtitle y tags.

### Caché frontend
- Al iniciar la app: si hay caché válida (TTL 24h), se usa; en paralelo se refresca desde el backend.
- Los stores actualizan localStorage tras cada mutación (create / update / delete) para que el siguiente arranque vea el cambio inmediatamente.

## Estructura del Proyecto

```
backend/
├── data/                              # gitignored: bookmarks.db + images/
├── src/
│   ├── db/
│   │   ├── connection.ts              # singleton Database (better-sqlite3)
│   │   ├── migrate.ts                 # schema inline + runMigrations()
│   │   └── queries/
│   │       ├── bookmarks.ts
│   │       └── categories.ts
│   ├── routes/
│   │   ├── bookmarks.ts               # CRUD + upload imagen
│   │   └── categories.ts              # CRUD
│   ├── types/index.ts
│   └── index.ts                       # boot: runMigrations + express.static + routers
└── package.json

src/
├── api/notion.ts                      # cliente axios + tipos input
├── components/
│   ├── BookmarkCard.vue               # botón Editar → /edit/:id
│   ├── BookmarkForm.vue               # formulario (crear/editar)
│   ├── BookmarkList.vue
│   ├── CategorySection.vue
│   ├── MegaCard.vue, MiniCard.vue
│   ├── SearchBox.vue, TagFilter.vue, Sidebar.vue
│   └── EmptyState.vue, ErrorMessage.vue, LoadingSpinner.vue
├── composables/                       # useBookmarks, useCategories, useCache, etc.
├── stores/
│   ├── bookmarks.ts                   # CRUD methods + invalidate()
│   └── categories.ts
├── views/
│   ├── HomeView.vue
│   ├── EditView.vue
│   └── CategoriesView.vue
├── router/index.ts                    # /, /edit/:id?, /categories
├── App.vue
└── main.ts
```

## Variables de Entorno

```env
PORT=3003
PUBLIC_BASE_URL=             # vacío en dev (Vite proxy /images → backend)
```

## Comandos

```bash
# Frontend
npm run dev
npm run build
npm run lint

# Backend
cd backend
npm run dev
npm run build
npm start
```

## Convenciones de Código

- Arrow functions para todas las funciones
- Composition API con `<script setup>`
- TypeScript estricto
- Nombres en español para variables de negocio si se prefiere claridad
