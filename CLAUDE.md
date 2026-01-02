# MyBookmarks2026

Aplicación Vue para gestionar y visualizar bookmarks almacenados en Notion.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vue Frontend  │ ──► │  Backend (API)  │ ──► │   Notion API    │
│   (SPA + Cache) │ ◄── │   (Proxy/Cache) │ ◄── │   (Databases)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Frontend (Vue 3 + TypeScript)
- SPA con Vue 3 Composition API
- Caché en localStorage para datos de Notion
- Búsqueda y filtrado en cliente

### Backend (Node.js/Express o similar)
- Proxy para Notion API (CORS)
- Endpoint para obtener bookmarks
- Endpoint para obtener categorías

## Notion Databases

### ToniBookmarks
- **Database ID**: `10a789da-9045-4013-829f-cba8b567046b`
- **Data Source ID**: `b2f81627-e9af-4a15-8c7b-78bd813e8c71`
- **URL**: https://www.notion.so/10a789da90454013829fcba8b567046b

### ToniBookmarksCategories
- **Database ID**: `8ff5170e-b891-4542-a1fd-04b4da92c0b1`
- **Data Source ID**: `fdb51ba2-c0ca-48df-8122-c59db0696cb4`
- **URL**: https://www.notion.so/8ff5170eb8914542a1fd04b4da92c0b1

## Modelo de Datos

### Bookmark (ToniBookmarks)
```typescript
interface Bookmark {
  id: string;
  name: string;                    // Name (title)
  url: string;                     // URL
  alternateUrl?: string;           // AlternateURL
  subtitle?: string;               // Subtitle
  tags: string[];                  // Tags (multi_select)
  categoryId?: string;             // Category (relation → ToniBookmarksCategories)
  visibleAtStart: boolean;         // Visible at Start (checkbox)
  status: 'Not started' | 'In progress' | 'Done';  // Status
  valoration?: '⭐' | '⭐⭐' | '⭐⭐⭐' | '⭐⭐⭐⭐' | '⭐⭐⭐⭐⭐';  // Valoration (select)
  imageUrl?: string;               // imageUrlBase (url) o imageUrl (formula)
  image?: string;                  // image (file)
  createdTime: string;             // Created time
}
```

**Tags disponibles**: IoT, Outside, Pirat, Torrent, iOS, Mac, Films, Shows, Music, Books, French, Comics, NAS, MacBookServer, 🎶 Media, Appartament, 🛠️ Tools, Freelance, Develop, Analisis, Sandboxes, Design, Documentation, HomeAssistant, CSS, Hosting, Stock, Textures, Video, VideoConf, 3dPrinting, 3dTools, Shopping, Servers, Gaming, AI, Email, People, Emulators, Translator, Learning, Arduino, Electronic, 3d, HTML, ReactJs, ReactNative, Córdoba, Git, kids, Icons, Images, Social, iot, DevTools, DesignTools, Personal, CommandLine, App, SystemTool, three.js, YouTube, Color, DevDocs, svg, RetroGaming, UseLess, Funny, Testing, home, inspiration, Shaders, DIY, crafts, CloudService, maps, AI Image Generation, MarkDown, PDF, art, music, photos, search, UI, Tools, Typography, roms, ChromeExtension, AI Video Generation, scrapping, player, VisualStudioCodeExtension, mockups, Emule, Tonterías, opensource, npm, canvas, webgl, MCP, VueJS

### Category (ToniBookmarksCategories)
```typescript
interface Category {
  id: string;
  name: string;       // Name (title)
  order: number;      // Order (number)
  level?: number;     // Level (number)
  padreId?: string;   // Padre (relation → self)
  hijoIds?: string[]; // Hijo (relation → self)
}
```

## Reglas de Negocio

### Vista Principal (Home)
1. **Estado inicial (sin filtros)**: Muestra solo bookmarks con `visibleAtStart: true`, agrupados por categoría y ordenados por `category.order`
2. **Con búsqueda activa**: Muestra TODOS los bookmarks que coincidan (ignora `visibleAtStart`)
3. **Con etiquetas activas**: Muestra TODOS los bookmarks con esas etiquetas (ignora `visibleAtStart`)
4. **Búsqueda**: Filtra por nombre, subtitle y tags

### Sistema de Etiquetas
- Las etiquetas funcionan como filtros acumulativos (OR/AND según se defina)
- Se muestran como botones toggle
- Al activar una etiqueta, se muestran todos los bookmarks que la contengan

### Caché
- Al iniciar la app, se descargan todos los datos de Notion
- Se almacenan en localStorage
- Incluir mecanismo de invalidación/actualización manual

## Estructura del Proyecto

```
src/
├── api/                    # Llamadas al backend
│   └── notion.ts
├── components/
│   ├── SearchBox.vue       # Caja de búsqueda
│   ├── TagFilter.vue       # Listado de etiquetas
│   ├── CategorySection.vue # Sección de categoría con sus bookmarks
│   ├── BookmarkCard.vue    # Tarjeta de bookmark individual
│   └── BookmarkList.vue    # Lista de bookmarks (búsqueda)
├── composables/
│   ├── useBookmarks.ts     # Lógica de bookmarks
│   ├── useCategories.ts    # Lógica de categorías
│   ├── useCache.ts         # Gestión de caché localStorage
│   └── useSearch.ts        # Lógica de búsqueda y filtrado
├── stores/                 # Pinia stores
│   ├── bookmarks.ts
│   └── categories.ts
├── types/
│   └── index.ts            # Interfaces TypeScript
├── views/
│   ├── HomeView.vue        # Vista principal
│   └── EditView.vue        # Vista de edición (Fase 2)
├── App.vue
└── main.ts
```

## Variables de Entorno

```env
VITE_API_URL=http://localhost:3000/api
```

Backend:
```env
NOTION_API_KEY=secret_xxx
NOTION_BOOKMARKS_DB_ID=10a789da-9045-4013-829f-cba8b567046b
NOTION_CATEGORIES_DB_ID=8ff5170e-b891-4542-a1fd-04b4da92c0b1
```

## Comandos

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Convenciones de Código

- Arrow functions para todas las funciones
- Composition API con `<script setup>`
- TypeScript estricto
- Nombres en español para variables de negocio si se prefiere claridad
