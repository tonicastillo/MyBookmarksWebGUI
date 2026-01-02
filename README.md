# MyBookmarks2026

Aplicación web para gestionar y visualizar bookmarks almacenados en Notion.

## Características

- Visualización de bookmarks agrupados por categorías
- Búsqueda por nombre, subtítulo y etiquetas
- Filtrado por etiquetas (combinación AND)
- Caché local en localStorage
- Accesos rápidos a categorías
- Diseño responsive con Tailwind CSS

## Requisitos

- Node.js 20+
- pnpm
- Cuenta de Notion con bases de datos configuradas

## Configuración de Notion

1. Crea una integración en [Notion Integrations](https://www.notion.so/my-integrations)
2. Comparte las bases de datos con la integración
3. Copia los IDs de las bases de datos:
   - `ToniBookmarks`: Base de datos de bookmarks
   - `ToniBookmarksCategories`: Base de datos de categorías

## Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd MyBookmarks2026

# Instalar dependencias del frontend
pnpm install

# Instalar dependencias del backend
cd backend && pnpm install && cd ..

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores
```

## Variables de entorno

```env
# Notion API Configuration
NOTION_API_KEY=secret_xxx
NOTION_BOOKMARKS_DB_ID=xxx
NOTION_CATEGORIES_DB_ID=xxx

# Server Configuration
PORT=3003
```

## Desarrollo

```bash
# Terminal 1: Backend
cd backend && pnpm run dev

# Terminal 2: Frontend
pnpm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3003

## Build

```bash
# Frontend
pnpm run build

# Backend
cd backend && pnpm run build
```

## Docker

### Build y ejecutar localmente

```bash
# Crear archivo .env
cp .env.example .env
# Editar con tus valores

# Construir y ejecutar
docker compose up --build
```

La aplicación estará disponible en http://localhost:3003

### Despliegue en Dokploy

1. Sube el repositorio a GitHub/GitLab
2. En Dokploy, crea una nueva aplicación y conecta el repositorio
3. Configura las variables de entorno:
   - `NOTION_API_KEY`
   - `NOTION_BOOKMARKS_DB_ID`
   - `NOTION_CATEGORIES_DB_ID`
4. Dokploy detectará el Dockerfile automáticamente

## Estructura del proyecto

```
MyBookmarks2026/
├── src/                    # Frontend Vue
│   ├── api/               # Cliente API
│   ├── components/        # Componentes Vue
│   ├── composables/       # Composables
│   ├── stores/            # Pinia stores
│   ├── types/             # TypeScript types
│   └── views/             # Vistas
├── backend/               # Backend Express
│   └── src/
│       ├── routes/        # Rutas API
│       ├── services/      # Servicios (Notion)
│       └── types/         # TypeScript types
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Configuración Docker
└── .env.example           # Variables de entorno
```

## Stack

- **Frontend**: Vue 3, TypeScript, Vite, Tailwind CSS, Pinia
- **Backend**: Node.js, Express, TypeScript
- **Base de datos**: Notion API
- **Despliegue**: Docker, Dokploy

## Licencia

MIT
