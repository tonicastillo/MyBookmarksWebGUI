---
created: 2026-05-25T08:00:05.556Z
title: Picker de colores SVG pierde selección de botones
area: ui
files:
  - src/components/ (color picker del editor de SVG / IconPicker)
---

## Problem

Flujo roto al recolorear varios colores de un SVG:

1. Seleccionamos uno o más botones de color del SVG.
2. Abrimos el color-picker.
3. Elegimos un color.
4. ✅ El picker se queda abierto.
5. ✅ El color se aplica a los botones seleccionados.
6. ❌ Los botones seleccionados se **deseleccionan** tras aplicar el color.

Como consecuencia, si el usuario elige otro color en el picker (que sigue abierto), no afecta a nada porque ya no hay botones seleccionados. El flujo de "probar varios colores sobre la misma selección" queda inutilizable.

## Solution

- Revisar el handler de cambio de color del picker: no debe limpiar `selectedButtons` / estado de selección.
- Solo deseleccionar al cerrar explícitamente el picker (o al hacer click fuera de los botones).
- Verificar que el estado de selección no se reactive desde un watcher sobre el color aplicado.
