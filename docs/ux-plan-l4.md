# L4 — Suscripciones con componentes compartidos

## Alcance y archivos
- `src/views/suscripciones.js`: conservar selector Tarjetas/Resumen en escritorio; forzar tarjetas en móvil sin sobrescribir la preferencia guardada; compartir el markup y los eventos de badges, acciones y menú entre tarjeta y tabla.
- `src/features/subscriptionActions.js`: conservar acciones y consultas existentes; usar las variantes comunes de botones en consulta de accesos.
- CSS coordinado con L1, sin nuevas definiciones de controles en las vistas.

## Contratos y preservación
- Se conservan los exports públicos, IDs de filtros, rutas, `state.currentView` y `pv_view_mode`.
- No cambian las llamadas `supabase.from()` ni `supabase.rpc()` ni sus parámetros.
- La preferencia de escritorio sigue en memoria/localStorage aunque el viewport pase por móvil.
- `btn-small` se aplica únicamente a acciones de la tabla; las tarjetas usan controles normales.

## Riesgos y comprobación
- Cambio de tamaño: verificar Resumen → móvil tarjetas → escritorio Resumen.
- Menú compartido: comprobar Renovar, Cobrar, Copiar, Ver accesos, Editar, Baja/Recuperar y Eliminar en ambas vistas con datos ficticios.
- Verificar badges con icono también para archivadas y sin fecha.
- Ejecutar comprobación sintáctica, `npm run check` y `npm run verify -- --strict`; capturas 360×780 y 1280×860 coordinadas por el agente principal.
