# Plan de cierre UX

Base: `3b06513`, destino del PR: `refactor/ux-limpieza`. Las decisiones finales del encargo prevalecen sobre Spec 01. No se modifican Supabase ni sus llamadas, dependencias ni frameworks.

## Lotes y archivos

1. L1: `src/styles/**`, `scripts/verify/**`. Tokens de control 40/44 y 32 solo tablas; tipografía, radios y espacios comunes. Mover estilos compartidos a componentes conservando sus usos. Estados inválido/activo/contraseña enmascarada reales. Verificador de uniformidad sin dependencias.
2. L2: `src/ui/modal.js`, `panel.js`, helper compartido de capas y `src/router.js`. Mantener contrato `openModal`; añadir `openPanel({ title, subtitle, body, footer, onClose }) → { el, close }`. Historial de capas sin datos sensibles, foco y Escape en la capa superior. Hash legado de creación abre modal sobre Suscripciones.
3. L3: `src/features/subscriptionForm.js`, sus módulos y estilos asociados; ancho renovación. Reorganizar presentación sin alterar guardado, idempotencia, importes ni parámetros de consultas.
4. L4: `src/views/suscripciones.js`, acciones compartidas. Mismos componentes para tarjetas/resumen; tarjetas obligatorias móvil, conservar preferencia escritorio.
5. L5: vistas Clientes, Catálogo, Proveedores y Plantillas, shell si necesita agrupación. Ficha cliente en panel, editar en modal. Contadores y acciones existentes.
6. L6: pruebas Playwright con Supabase interceptado y sesión ficticia, capturas 360×780 / 1280×860; documentación Spec 01 y FRONTEND, evidencia y criterios de cierre.

## Verificación y riesgos

Cada lote: `npm run check`, `npm run verify -- --strict`, búsqueda de literales en vistas y revisión de diff. Revisar capturas reales de pantallas afectadas; no declarar verificado lo no ejecutado. Pruebas de atrás, Escape, Tab/Shift+Tab, foco restaurado, anidamiento confirmación y panel/modal. Medir controles y scroll inicial del formulario. Riesgos: regresiones de cascada al centralizar CSS, doble navegación al cerrar capas y mantener valores/autocompletado al reorganizar formulario. No se eliminan archivos. Toda excepción de uniformidad debe tener motivo local explícito.

## Fuentes oficiales consultadas mediante TinyFish

- https://developer.mozilla.org/en-US/docs/Web/API/History/pushState
- https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- https://playwright.dev/docs/network

No existe `docs/design/stitch/` en el commit base.
