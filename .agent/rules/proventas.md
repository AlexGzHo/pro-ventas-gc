# Reglas del workspace PRO VENTAS GC (siempre activas)

Antes de cualquier tarea en este repositorio, lee y sigue `AGENTS.md` (raíz). Resumen de lo innegociable:

1. Trabaja desde una spec de `docs/specs/`. Si no hay spec o no cubre el caso, pregunta; no inventes.
2. Plan escrito antes de editar. Espera aprobación si tocas Supabase, borras archivos o cambias contratos.
3. Lee los archivos y sus usos antes de modificarlos. Reutiliza lo que existe en `src/ui/`, `src/state.js` y `src/styles/`.
4. No edites con scripts de reemplazo ni regex. No añadas llaves al final de un archivo para "arreglar" sintaxis.
5. No respondas de memoria sobre APIs de Supabase/navegador: consulta la documentación oficial actual.
6. `npm run check` debe pasar antes de cada commit. Capturas reales a 360/1280 px si tocaste la interfaz.
7. Producción de Supabase es solo lectura. Las migraciones se prueban en staging con `supabase/tests/`.
8. Nunca pidas ni manejes tokens de sesión, contraseñas o claves.
9. Reporta con evidencia; si algo no se verificó, dilo.
