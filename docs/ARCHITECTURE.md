# Arquitectura Técnica: PRO VENTAS GC

## Componentes y Modelo de Base de Datos

- **Base de Datos:** PostgreSQL en Supabase.
- **Acceso:** Cliente `@supabase/supabase-js` con Row Level Security (RLS) y funciones RPC con `SECURITY DEFINER` para operaciones atómicas.

### Módulos Principales
- **Clientes (`public.clients`):** Gestión de datos de contacto de clientes.
- **Proveedores (`public.providers`):** Datos de proveedores de cuentas/servicios.
- **Productos (`public.products`):** Catálogo de servicios disponibles con precios base.
- **Suscripciones (`public.subscriptions`):** Registros activos e históricos de suscripciones asignadas.
- **Renovaciones (`public.subscription_renewals`):** Historial financiero y control de renovaciones sucesivas con claves de idempotencia.
- **Plantillas de WhatsApp (`public.whatsapp_templates`):** Almacenamiento sincronizado de los mensajes automáticos (recordatorio, cobro, actualización).

### Dependencias y Restricciones Estructurales
- **Clientes & Productos:** Protegidos contra eliminación accidental. La relación de `subscriptions` hacia `clients` y `products` utiliza `ON DELETE RESTRICT`. Requieren reasignación o eliminación de sus suscripciones previas.
- **Proveedores:** Flexibilidad de retención. Su relación usa `ON DELETE SET NULL`, permitiendo eliminar proveedores (si se decide forzar) dejando los registros asociados huérfanos temporalmente, aunque se recomienda reasignar transaccionalmente.

---

## Funciones RPC Críticas

- `create_subscription_v3`: Alta transaccional de suscripción vinculando cliente, producto y proveedor, con registro en el historial financiero inicial.
- `process_renewal`: Extensión de vigencia y cálculo financiero en soles/USDT.
- `delete_subscription_transactional`: Eliminación atómica y definitiva de una suscripción y todas sus renovaciones asociadas (`subscription_renewals`), validando autorización de usuario y bloqueo por fila (`FOR UPDATE`).
- `delete_client` y `merge_clients`: Mantenimiento seguro de directorio de clientes, respetando bloqueos relacionales (`RESTRICT`).
- `delete_provider` y `merge_providers`: Mantenimiento seguro y reasignación de dependencias (productos y suscripciones) para proveedores.

---

## Estado Operativo y Despliegue de Esquemas

> [!NOTE]
> **Eliminación Transaccional (`delete_subscription_transactional`):**
> - La función fue desplegada e instalada **manualmente** en la base de datos de producción mediante SQL Editor.
> - Ejecuta la eliminación transaccional y atómica de registros en `public.subscriptions` y sus dependencias en `public.subscription_renewals`.
> - Su definición está reflejada en los esquemas declarativos (`supabase/schemas/`) y en la migración local `supabase/migrations/20261010000000_v4_transactional_delete.sql`.
> - **Historial de Migraciones:** El registro formal en la tabla `supabase_migrations.schema_migrations` continúa **pendiente de reconciliación** mediante `supabase migration repair`.
