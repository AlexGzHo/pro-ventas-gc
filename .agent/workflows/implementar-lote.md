---
description: Implementar un lote de una spec de docs/specs con plan, verificación y reporte
---

# /implementar-lote

Uso: `/implementar-lote <spec> <lote>`  (ejemplo: `/implementar-lote 01 B3`)

1. Lee `AGENTS.md` y la spec indicada completa (`docs/specs/<spec>-*.md`), en especial: alcance, "Fuera de alcance",
   criterios de aceptación y la fila del lote en la tabla de implementación.
2. Confirma que las dependencias del lote ya están hechas (`git log`, revisa los archivos). Si no, detente y avisa.
3. Lee todos los archivos del lote y busca sus usos (`grep -rn` de cada función/clase/hash que vayas a cambiar).
4. Si el lote toca una API externa (Supabase, Clipboard, History API…), consulta su documentación oficial actual y anota la URL.
5. Escribe el plan como artefacto: archivos, contratos (exports, parámetros, clases CSS, hashes), pasos, riesgos y cómo
   verificarás cada criterio. Si toca Supabase, borra archivos o cambia contratos, **espera aprobación**.
6. Implementa editando a mano, en pasos pequeños. Después de cada paso relevante ejecuta `npm run verify`.
7. Verificación final:
   - `npm run check` sin errores.
   - `npm run verify -- --strict`: sin clases nuevas sin estilos.
   - Si hay UI: capturas reales a 360 y 1280 px con datos simulados de cada pantalla afectada. Ábrelas y revísalas.
8. Commit con mensaje descriptivo (`feat|fix|refactor(<área>): ...`) y push a la rama de trabajo. Un lote = un commit.
9. Reporta con el formato de `AGENTS.md` §6, mapeando cada criterio de aceptación.
