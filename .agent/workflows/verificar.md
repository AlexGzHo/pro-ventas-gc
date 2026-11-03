---
description: Verificación completa del proyecto antes de entregar o hacer commit
---

# /verificar

1. `npm run check` (verificadores de CSS, tokens, iconos y clases + tests + build). Pega la salida resumida.
2. `npm run verify -- --strict` y lista cualquier clase sin estilos. Corrígela o, si es solo un gancho de JS,
   agrégala a `scripts/verify/class-hooks.txt` con un comentario que explique qué la usa.
3. `git status` y `git log origin/<rama>..HEAD`: confirma que no queda nada sin commit ni sin push.
4. `grep -rnE "alert\(|confirm\(|prompt\(|console\.log" src` → debe estar vacío (salvo `console.error` en manejo de errores).
5. Si hubo cambios de UI: capturas a 360 y 1280 px. Comprueba que los archivos son distintos entre sí y que se ven bien.
6. Informa qué se verificó y qué no se pudo verificar.
