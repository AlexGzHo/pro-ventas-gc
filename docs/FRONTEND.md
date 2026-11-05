# Especificación Frontend: PRO VENTAS GC

## 1. Arquitectura y Tecnología
- **Stack:** JavaScript Vanilla (ES Modules) + Vite + CSS nativo modularizado.
- **Sin frameworks ni librerías externas:** Cero dependencias añadidas (sin React, Vue, Lodash, Axios, Tailwind o Bootstrap).
- **Consumo de Datos:** Cliente oficial `@supabase/supabase-js` conectado a PostgreSQL con Row Level Security (RLS) y llamadas RPC atómicas.
- **Enrutamiento:** Enrutador declarativo hash-based (`src/router.js`) con mapa `ROUTES` que preserva el estado en recargas y transiciones directas.
- **Gestión de Estado:** Estado centralizado reactivo en memoria (`src/state.js`) con caché inteligente de entidades e invalidación tras mutaciones.

---

## 2. Estructura de Navegación

### Escritorio (Topbar + Sidebar Contraíble)
Organizado en dos secciones principales:
- **Operación:**
  - **Inicio (`#inicio`):** Dashboard con módulo prioritario *"Requiere atención"* (cobros urgentes en ≤3 días) y 4 KPIs financieros ejecutivos en soles (PEN) o dólares (USDT) con tipo de cambio dinámico.
  - **Suscripciones (`#suscripciones`):** Explorador central de ventas y cuentas con buscador en tiempo real, popover de filtros (Servicio y Propietario), chips de estado con contadores en vivo y tarjetas simplificadas con toggle a vista Resumen (tabla).
  - **Clientes (`#clientes`):** Directorio de clientes con indicador de próxima renovación, historial de suscripciones activas y archivadas, y herramienta de fusión asistida (`merge_clients`).
- **Configuración:**
  - **Catálogo de Servicios (`#productos`):** Base de datos de productos con precios sugeridos, costos sugeridos y categorías visuales.
  - **Proveedores (`#proveedores`):** Registro de proveedores con accesos a WhatsApp, Telegram, sitio web y herramienta de reasignación asistida (`merge_providers`).
  - **Plantillas WhatsApp (`#plantillas`):** Editor de mensajes de cobro, recordatorio, actualización y credenciales con inserción visual de variables dinámicas.
  - **Acceso Rápido:** Botón destacado `+ Nueva suscripción`, que abre el modal. Los hashes legados `#nueva` y `#nueva-suscripcion` abren ese modal sobre Suscripciones.

### Móvil (Bottom Navigation Bar ≤ 640px)
Barra fija inferior optimizada para operación rápida con una sola mano:
- **Inicio**
- **Suscripciones**
- **Clientes**
- **Más** (menú flotante para Catálogo, Proveedores, Plantillas y Salir).

---

## 3. Componentes Principales y Flujos

### Tarjeta de Suscripción (Jerarquía en 3 Líneas)
- **Línea 1:** Logo e iniciales del servicio + nombre del servicio + badge cromático de estado (ej. *"Vence en 3 días"*).
- **Línea 2:** Nombre del cliente y botón táctil para cobro directo por WhatsApp.
- **Línea 3:** Fecha exacta de vencimiento a la izquierda, precio de venta a la derecha y punto de color del propietario (Alex o Liz).
- **Acciones Directas:** Botones táctiles de alta visibilidad para *Renovar*, *Cobrar (WhatsApp)* y *Copiar todo*.
- **Menú Extendido (⋯):** Enviar datos, Enviar actualización, Editar, Dar de baja / Recuperar, y Eliminar definitivo (rojo crítico con confirmación).
- **Detalle Desplegable:** Despliega credenciales protegidas (usuario, contraseña con botón toggle, perfil, PIN, URL, costo, ganancia y notas).
- **Responsive:** Tarjetas / Resumen permanece en escritorio. A ≤640 px se oculta el selector y se muestran tarjetas, sin perder la preferencia de escritorio.

### Formulario de Suscripción (`src/features/subscriptionForm.js`)
Crear y editar siempre usa modal de 560 px, con encabezado y pie visibles y solo cuerpo desplazable. Pantalla completa y una columna a ≤640 px. No existe página independiente de creación.
1. **Cliente y Servicio:** Buscadores del mismo tipo; cliente existente o creación inline con teléfono; servicio del catálogo con autocompletado de precio, costo, duración y proveedor.
2. **Duración y montos:** Chips de 1/3/6/12 meses, inicio hoy y vencimiento visible. «Cambiar fechas» despliega inicio y vencimiento. Precio de venta y Costo con moneda dentro del campo; Ganancia en una línea. Tipo de cambio y Equivalente aparecen solo para USDT.
3. **Accesos:** Usuario/correo con sugerencias de dominio, contraseña con mostrar/ocultar, Perfil y PIN.
- **Bloque plegable "Más detalles":** URL de acceso, Proveedor, Vencimiento del proveedor, Campos extra y Notas internas. Cerrado al crear; abierto al editar si tiene datos.
- **Garantías:** Botón con estado "Guardando…", validaciones inline bajo los campos y clave de idempotencia única.

### Modal de Renovación (`src/features/renewModal.js`)
- Resumen en cabecera del cliente, servicio y vigencia actual.
- Chips de duración seleccionables (`7d`, `15d`, `1m`, `3m`, `6m`, `12m`).
- Selector de fecha de inicio: *Automático* o *Elegir fecha manual*.
- Previsualización en vivo: *"Nuevo vencimiento: dd/mm/aaaa"*.
- Confirmación atómica mediante RPC `process_renewal` con clave de idempotencia y opción posterior inmediata para notificar al cliente vía WhatsApp.

---

## 4. Primitivas de UI Reutilizables (`src/ui/`)
- **Modales (`ui/modal.js`):** Crear/editar. Dos anchos: 420 px (cliente, confirmaciones, renovar) y 560 px (suscripción, producto, proveedor). Encabezado/pie visibles, cuerpo desplazable; pantalla completa a ≤640 px.
- **Panel (`ui/panel.js`):** Consultar ficha de cliente, 440 px a la derecha o pantalla completa móvil. API `openPanel({ title, subtitle, body, footer, onClose }) → { el, close }`. Datos, contadores Vigentes/Vencen pronto/Vencidas y acciones Renovar/Cobrar/Ver. Editar abre el modal correspondiente.
- **Capas e historial:** Aperturas añaden una entrada, Atrás cierra la capa superior conservando sección. Escape, Tab/Shift+Tab, foco restaurado y nombre accesible mediante `aria-labelledby`. No almacenar datos de clientes o credenciales en History API.
- **Confirmaciones (`ui/confirm.js`):** Cuadro de diálogo asíncrono `confirmDialog()` que erradica por completo los `confirm()` y `alert()` nativos.
- **Notificaciones (`ui/toast.js`):** Toasts dinámicos en esquina inferior con deduplicación y auto-dismiss.
- **Iconografía (`ui/icons.js`):** Catálogo centralizado de SVG consistentes y escalables.

## 5. Contrato visual y verificación

`tokens.css` es la fuente de valores: controles 40 px / 44 px móvil, sm 32 px solo en tablas; tipografía 12/13/14/16/20/24 px con pesos 400/500/600; radios 8/12/999 px; espaciado exclusivamente con `--space-*`. `components.css` define controles, campos, buscadores, chips, badges con icono+texto, tarjetas, estadísticas, tablas, encabezados, toolbars, vacíos, modales y paneles. `layout.css` define el shell; las vistas solo añaden layout.

Los estados `.is-invalid`, `.current`, `.filter-active` y `.cred-masked` tienen estilos reales. `scripts/verify/uniformity.mjs` comprueba literales y redefiniciones de controles en vistas; excepciones con `/* uniformity-ok: motivo */` en la misma línea.

Antes de cada lote: `npm run check` y `npm run verify -- --strict`. La verificación visual usa Playwright local, Supabase interceptado, sesión y datos ficticios, con capturas 360×780 y 1280×860. Medir controles, scroll inicial del formulario, navegación Atrás, Escape y foco. Los resultados ejecutados y cualquier limitación se documentan en la evidencia del PR; el recorrido con cuenta real corresponde al propietario.

Decisiones completas y criterios de cierre: [Spec 01](specs/01-reorganizacion-ux.md).
