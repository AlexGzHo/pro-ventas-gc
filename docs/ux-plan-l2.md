# Plan L2 — Diálogos, paneles e historial

Decisiones finales del encargo prevalecen sobre Spec 01. Sin Supabase, dependencias ni cambios de parámetros de consultas.

- Crear `src/ui/overlay.js`: infraestructura compartida de modal/panel. Pila de overlays, una entrada `history.pushState` por apertura y cierre del superior con atrás/Escape. Fondo inerte, foco atrapado y restaurado, nombre accesible con `aria-labelledby`.
- Adaptar `src/ui/modal.js` preservando `openModal` y retorno `{ el, backdrop, close }`; dos tamaños efectivos `sm` (420) y `md` (560), alias `lg/full` a `md` para consumidores existentes.
- Crear `src/ui/panel.js`, contrato solicitado `openPanel({ title, subtitle, body, footer, onClose }) → { el, close }`, clases `panel-*`, ancho 440 y pantalla completa móvil a través de componentes CSS.
- Modificar `src/router.js`: quitar formulario como página. Los hashes heredados `#nueva-suscripcion`, `#nueva`, `#editar-suscripcion` y `#editar` resuelven a Suscripciones y abren el modal. Mantener nombres y hashes de todas las secciones.
- El contenido del diálogo usa el host existente `#modalHost`. Encabezado/cuerpo/pie son hermanos para mantener solo el cuerpo desplazable.

Riesgos: diálogos anidados (confirmación sobre formulario/panel), foco en elementos ocultos, cierre repetido y navegación de sección con un overlay abierto. Verificar con navegador: atrás cierra solo superior, Cancelar y Escape no dejan entradas vacías, Tab/Shift+Tab no salen, foco vuelve al disparador y hash heredado no monta un formulario en página. Ejecutar sintaxis, verify/check y pruebas de navegador disponibles antes de commit (root integra evidencia y commit del lote).

Referencias consultadas por el agente principal: MDN History.pushState y popstate, WAI-ARIA APG Dialog (Modal) Pattern.

## Verificación local del lote

- `node --check` de router, overlay, modal, panel y confirmación: pasa.
- Chromium local con Playwright de Python preinstalado, fixture exclusivamente ficticio servido en `127.0.0.1:8766`: pasan rol/nombre, foco inicial omitiendo campos ocultos, fondo inerte, Tab/Shift+Tab, modal anidado sobre panel, Escape solo superior, atrás conservando la sección, devolución de foco y cierre repetido idempotente.
- Segunda prueba de Chromium: Escape consumido por combobox no cierra el modal; cambiar sección consume las dos entradas de panel + modal; atrás no encuentra capas vacías; confirmación cancelada resuelve false y su temporizador no roba foco al panel.
- Scripts locales de evidencia: `/tmp/test-overlays.py` y `/tmp/test-overlay-navigation.py`; sin llamadas a Supabase, credenciales ni datos reales.
- `verify --strict` durante integración: inicialmente detectó clases nuevas de otros lotes y `.overlay-open` pendientes de estilos L1. El agente principal integra el resultado final de check y strict antes del commit.
