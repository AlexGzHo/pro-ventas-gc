# Plan L5 — Clientes y módulos de configuración

Decisiones finales del usuario prevalecen sobre Spec 01. No se renombran secciones ni se modifica Supabase.

- `src/views/clientes.js`: consultar la ficha mediante `openPanel`, conservar formularios en modal corto de 420 px; corregir contador Vigentes para excluir vencidas; añadir Renovar/Cobrar/Ver reutilizando acciones existentes, sin consultas nuevas. Datos del panel proceden de las consultas actuales.
- `src/views/productos.js`, `proveedores.js`, `whatsappTemplates.js`: adoptar `.page-header`, `.card`, `.field`, botones y badges comunes; mantener formularios de producto/proveedor en modal de 560 px.
- `src/shell.js`: comprobar grupos Operación/Configuración y nombres actuales; conservarlos si ya son correctos.
- Contratos: exports de montaje, callbacks, hashes de secciones y parámetros de todas las consultas/RPC permanecen intactos. Nuevo consumo del contrato `openPanel({ title, subtitle, body, footer, onClose })`.
- Coordinación: CSS pertenece al lote L1; no editar estilos en este lote. El helper de panel e historial pertenece a L2.
- Riesgos: historial al navegar desde el panel, refresco de datos después de renovar y contraste/espacio en panel de 440 px.
- Verificación: `node --check` en archivos modificados; `npm run check`, `npm run verify -- --strict`, diff de llamadas Supabase; recorrido con datos ficticios y capturas 360×780/1280×860 por el coordinador. No declarar comprobación visual sin evidencia.
