---
created: 2026-05-25T08:00:05.556Z
title: Logo de Home debe resetear filtros y scroll
area: ui
files:
  - src/components/Sidebar.vue (o donde viva el logo "MyBookmarks")
  - src/views/HomeView.vue
  - src/stores/ (store de filtros / búsqueda / tags activos)
---

## Problem

Al hacer click en el logo "MyBookmarks" desde la home, actualmente solo navega a `/`. Si el usuario ya está en la home con filtros aplicados (búsqueda, tags activos, scroll bajado), el click no hace nada visible — se queda igual.

Esperado: el logo debe actuar como un "reset" del estado de la home.

## Solution

En el handler del click del logo:

1. `router.push('/')` (ya existe).
2. Resetear estado de búsqueda: limpiar query, tags activos, cualquier filtro.
3. `window.scrollTo({ top: 0, behavior: 'smooth' })`.

Considerar extraer la lógica de reset a una acción del store para reutilizar.
