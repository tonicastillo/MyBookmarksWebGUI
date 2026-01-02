# Tareas - MyBookmarks2026

## Fase 1: Visualización

### 1. Setup del Proyecto
- [ ] Inicializar proyecto Vue 3 con Vite y TypeScript
- [ ] Configurar ESLint y Prettier
- [ ] Instalar dependencias: Pinia, Vue Router, Axios
- [ ] Configurar estructura de carpetas

### 2. Backend (Proxy API)
- [ ] Crear servidor Express básico
- [ ] Configurar conexión con Notion API
- [ ] Endpoint GET `/api/bookmarks` - obtener todos los bookmarks
- [ ] Endpoint GET `/api/categories` - obtener todas las categorías
- [ ] Configurar CORS para desarrollo local

### 3. Tipos e Interfaces
- [ ] Definir interface `Bookmark`
- [ ] Definir interface `Category`
- [ ] Definir tipos para respuestas de API

### 4. Sistema de Caché
- [ ] Composable `useCache` para gestionar localStorage
- [ ] Función para guardar datos en caché
- [ ] Función para recuperar datos de caché
- [ ] Función para invalidar/limpiar caché
- [ ] Timestamp de última actualización

### 5. Stores (Pinia)
- [ ] Store de bookmarks con estado y acciones
- [ ] Store de categorías con estado y acciones
- [ ] Integración con sistema de caché
- [ ] Carga inicial de datos al iniciar la app

### 6. Composables
- [ ] `useBookmarks` - lógica de negocio de bookmarks
- [ ] `useCategories` - lógica de negocio de categorías
- [ ] `useSearch` - lógica de búsqueda y filtrado
- [ ] `useTags` - extracción y gestión de etiquetas

### 7. Componentes UI

#### SearchBox.vue
- [ ] Input de búsqueda con debounce
- [ ] Emitir evento con término de búsqueda
- [ ] Botón para limpiar búsqueda

#### TagFilter.vue
- [ ] Mostrar todas las etiquetas disponibles
- [ ] Botones toggle para activar/desactivar etiquetas
- [ ] Emitir etiquetas seleccionadas
- [ ] Indicador visual de etiquetas activas

#### CategorySection.vue
- [ ] Mostrar nombre de categoría
- [ ] Listar bookmarks de la categoría
- [ ] Props: categoría y sus bookmarks

#### BookmarkCard.vue
- [ ] Mostrar título como enlace
- [ ] Mostrar descripción
- [ ] Mostrar etiquetas
- [ ] Diseño responsive

#### BookmarkList.vue
- [ ] Lista plana de bookmarks (para búsqueda)
- [ ] Sin agrupación por categorías

### 8. Vista Principal (HomeView)
- [ ] Integrar SearchBox
- [ ] Integrar TagFilter
- [ ] Mostrar categorías con bookmarks (estado inicial)
- [ ] Mostrar lista plana en búsqueda/filtro
- [ ] Lógica de cambio entre modos de visualización
- [ ] Loading state mientras carga datos
- [ ] Estado vacío cuando no hay resultados

### 9. Estilado
- [ ] Definir variables CSS / tema
- [ ] Estilos base y reset
- [ ] Estilos responsive
- [ ] Estados hover/focus accesibles

### 10. Testing y QA
- [ ] Probar búsqueda con diferentes términos
- [ ] Probar filtrado por etiquetas
- [ ] Probar combinación búsqueda + etiquetas
- [ ] Verificar que caché funciona correctamente
- [ ] Probar en diferentes navegadores

---

## Fase 2: Edición (Futuro)

### Componentes de Edición
- [ ] Formulario de edición de bookmark
- [ ] Formulario de edición de categoría
- [ ] Modal de confirmación de borrado

### Backend Adicional
- [ ] Endpoint POST `/api/bookmarks` - crear bookmark
- [ ] Endpoint PUT `/api/bookmarks/:id` - actualizar bookmark
- [ ] Endpoint DELETE `/api/bookmarks/:id` - eliminar bookmark
- [ ] Endpoints similares para categorías

### Vista de Edición
- [ ] Lista de todos los bookmarks (editable)
- [ ] Gestión de categorías
- [ ] Sincronización con Notion

---

## Notas Técnicas

### Prioridad de Tareas
1. Setup y Backend (base necesaria)
2. Tipos y Stores (estructura de datos)
3. Sistema de Caché (rendimiento)
4. Componentes básicos
5. Vista principal y lógica de filtrado
6. Estilado y pulido

### Dependencias Principales
```json
{
  "vue": "^3.4",
  "vue-router": "^4",
  "pinia": "^2",
  "axios": "^1",
  "@notionhq/client": "^2"
}
```

### Consideraciones
- El backend puede ser serverless (Vercel/Netlify functions) o Express tradicional
- Considerar rate limits de Notion API
- El caché debe manejar datos grandes eficientemente
