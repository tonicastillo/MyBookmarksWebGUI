---
created: 2026-05-25T08:00:05.556Z
title: Avisar antes de cerrar edición de bookmark con cambios
area: ui
files:
  - src/components/BookmarkForm.vue
  - src/views/EditView.vue
---

## Problem

Al cerrar o navegar fuera de la pantalla de edición de un bookmark (`/edit/:id?`), no se avisa al usuario si hay cambios sin guardar. El usuario puede perder modificaciones silenciosamente al volver atrás, cambiar de ruta o cerrar la pestaña.

## Solution

- Trackear `dirty state` del formulario (`BookmarkForm.vue`): comparar valores actuales contra el snapshot inicial al montar.
- En `EditView.vue`, usar `onBeforeRouteLeave` para mostrar confirmación si `isDirty === true`.
- Añadir handler `beforeunload` en window para cubrir cierre de pestaña / recarga.
- Confirmar con diálogo nativo (`confirm(...)`) o modal propio si queremos consistencia visual.
