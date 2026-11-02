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
  - **Acceso Rápido:** Botón destacado `+ Nueva suscripción` (`#nueva`).

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

### Formulario de Suscripción (`src/features/subscriptionForm.js`)
Estructurado en 3 bloques lógicos con soporte modal o pantalla completa:
1. **Cliente y Servicio:** Control combinado para buscar clientes existentes o crear nuevos inline con teléfono; selector de servicio del catálogo con autocompletado de precios y dominios de correo.
2. **Accesos:** Usuario/correo con sugerencias de dominio, contraseña con toggle mostrar/ocultar, perfil, PIN y URL.
3. **Fechas y Montos:** Fecha de inicio y vencimiento (con botones rápidos `+1m`, `+3m`, `+6m`, `+12m`), precios y costos en PEN o USDT, y selección de proveedor.
- **Bloque Plegable "Más opciones":** Vencimiento del proveedor, campos extra y notas privadas.
- **Garantías:** Botón con estado "Guardando…", validaciones inline bajo los campos y clave de idempotencia única.

### Modal de Renovación (`src/features/renewModal.js`)
- Resumen en cabecera del cliente, servicio y vigencia actual.
- Chips de duración seleccionables (`7d`, `15d`, `1m`, `3m`, `6m`, `12m`).
- Selector de fecha de inicio: *Automático* o *Elegir fecha manual*.
- Previsualización en vivo: *"Nuevo vencimiento: dd/mm/aaaa"*.
- Confirmación atómica mediante RPC `process_renewal` con clave de idempotencia y opción posterior inmediata para notificar al cliente vía WhatsApp.

---

## 4. Primitivas de UI Reutilizables (`src/ui/`)
- **Modales (`ui/modal.js`):** Apertura modal con backdrop difuminado, tecla `Escape`, clic fuera, autoenfoque y bloqueo de scroll.
- **Confirmaciones (`ui/confirm.js`):** Cuadro de diálogo asíncrono `confirmDialog()` que erradica por completo los `confirm()` y `alert()` nativos.
- **Notificaciones (`ui/toast.js`):** Toasts dinámicos en esquina inferior con deduplicación y auto-dismiss.
- **Iconografía (`ui/icons.js`):** Catálogo centralizado de SVG consistentes y escalables.
