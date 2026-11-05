# Plan L1 — Uniformización visual

Se conservan las clases públicas y sus selectores JavaScript; se agrupan sus estilos visuales en componentes compartidos. No se eliminan funcionalidades ni se modifica Supabase.

- `src/styles/tokens.css`: fuente única de alturas (40/44 y 32 en tablas), tipografía, radios y espacios; aliases existentes resuelven a esos tokens.
- `src/styles/base.css`: reset y accesibilidad; los controles pasan a `components.css`.
- `src/styles/components.css`: controles, estados, tarjetas, estadísticas, tablas y diálogos; aliases de clases existentes para migración sin romper consumidores.
- `src/styles/views/*.css`: solo disposición específica de cada pantalla. El formulario se coordina con L3.
- `src/styles/layout.css`: geometría del shell, con tipografía/controles compartidos.
- `scripts/verify/uniformity.mjs` e `index.mjs`: comprobar literales y redefinición de controles en vistas, con excepciones explícitas por línea; sin dependencias.
- `scripts/verify/class-hooks.txt`: retirar estados visibles e implementar su apariencia.

Riesgos: cascada y selectores dinámicos. Se conservarán aliases y se comprobarán clases, tokens, estructura y uniformidad, además del recorrido visual con datos ficticios a cargo del integrador. No se declararán pruebas ejecutadas cuando el entorno no las permita.
