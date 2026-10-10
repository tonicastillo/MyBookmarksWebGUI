# Extensión MyBookmarks

Extensión Manifest V3 para Chrome, Edge, Brave, Arc, Opera y Firefox (128+).
JavaScript sin build: se carga la carpeta tal cual.

## Instalar (modo desarrollador)

**Chrome / Edge / Brave / Arc**
1. Abre `chrome://extensions` y activa «Modo de desarrollador».
2. «Cargar descomprimida» → selecciona esta carpeta `extension/`.
3. Se abre la página de opciones: pega la URL del servidor y pulsa «Guardar y conectar».

**Firefox**
1. Abre `about:debugging#/runtime/this-firefox` → «Cargar complemento temporal».
2. Selecciona `extension/manifest.json`.

## Uso

- Popup: `⌘⇧K` (Mac) / `Alt+Shift+K`.
  - Sin texto: árbol categorías → subcategorías → mega cards → bookmarks. `→`/`←` o clic
    abren y cierran carpetas; las carpetas abiertas se recuerdan.
  - Al escribir: lista plana con búsqueda difusa igual que la app.
  - `↵` pestaña nueva · `⌘↵`/`Ctrl↵` segundo plano · `⇧↵` pestaña actual.
  - `⇥` en un bookmark con `searchUrlTemplate` → busca dentro de ese sitio. `Esc` para salir.
- Barra de direcciones: `bm` + espacio + texto.

## Autenticación y caché

- Usa la cookie de sesión `mb_session` del servidor: si ya estás logueado en la web, funciona sin más.
  Si no, el popup muestra un formulario de login.
- Caché en `chrome.storage.local`: se muestra al instante, se refresca al abrir el popup
  si tiene más de 5 min y cada 30 min en segundo plano.

## Estructura

```
manifest.json
background.js        # alarma de sync + omnibox
lib/data.js          # ajustes, caché, llamadas a /api
lib/search.js        # índice Fuse.js (misma config que src/composables/useFuzzySearch.ts)
lib/fuse.min.mjs     # Fuse.js 7.5.0 copiado de node_modules
popup/               # UI principal
options/             # URL del servidor + permiso de host
```
