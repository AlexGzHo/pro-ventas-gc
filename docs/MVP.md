# Alcance del Producto (MVP): PRO VENTAS GC

## 1. Propósito y Valor del Negocio
PRO VENTAS GC centraliza y automatiza el control operativo y financiero de cuentas y suscripciones de streaming, entretenimiento y software para dos usuarios operativos (**Alex** y **Liz**), erradicando las planillas de cálculo manuales.

---

## 2. Modelo de Entidades y Base de Datos
El sistema opera sobre un esquema relacional normalizado en PostgreSQL (Supabase) con integridad referencial y seguridad RLS:

1. **Clientes (`clients`):** Directorio unificado con nombre, teléfono WhatsApp normalizado y notas.
2. **Productos (`products`):** Catálogo formal de servicios con precios sugeridos de venta, costos base y categorías (Entretenimiento, IA y Productividad, Diseño, Educación, Almacenamiento, Otros).
3. **Proveedores (`providers`):** Directorio de proveedores de cuentas con canales de contacto directo (WhatsApp, Telegram, Web).
4. **Suscripciones (`subscriptions`):** Registros operativos de cuentas activas y dadas de baja, vinculando cliente, producto, proveedor, credenciales completas, fechas de vigencia y propietario asignado.
5. **Renovaciones (`subscription_renewals`):** Historial transaccional de cada periodo renovado con montos financieros, tipo de cambio e idempotencia.
6. **Plantillas de WhatsApp (`whatsapp_templates`):** Mensajería dinámica personalizable sincronizada para cobro, recordatorio, actualización y credenciales.

---

## 3. Capacidades Incluidas en el Sistema

### Operación y Ventas
- Autenticación segura vía Supabase Auth con recuperación de contraseña.
- Alta transaccional de suscripciones con detección de duplicados, creación inline de clientes y clave de idempotencia (`create_subscription_v3`).
- Renovaciones ágiles por periodos predefinidos (`7d`, `15d`, `1m`, `3m`, `6m`, `12m`) con fecha automática o manual (`process_renewal`).
- Ciclo de vida completo: edición, baja temporal (archivado), reactivación y eliminación transaccional atómica (`delete_subscription_transactional`).
- Copiado seguro e individual de credenciales (correo, contraseña, perfil, PIN, URL) y bloque unificado de accesos.
- Mensajería WhatsApp instantánea (`wa.me`) con codificación de caracteres, soporte de emojis e interpolación de variables.

### Inteligencia y Finanzas
- Dashboard ejecutivo con lista priorizada *"Requiere atención"* (cuentas por vencer ≤ 3 días o vencidas) para cobranza rápida.
- 4 KPIs financieros consolidados con alternancia en tiempo real entre Soles (PEN) y Dólares (USDT) con tipo de cambio dinámico.
- Historial financiero estructurado por periodo y cálculo automático de márgenes de ganancia.

### Mantenimiento y Catálogos
- Fusión asistida de perfiles de clientes (`merge_clients`) para transferir suscripciones y consolidar números de teléfono.
- Reasignación de dependencias de proveedores (`merge_providers`) antes de eliminación.
- Gestión de catálogo de productos clasificados por categoría formal.
- Personalización de plantillas de WhatsApp desde la propia interfaz.

---

## 4. Fuera del Alcance Actual
- Envío automatizado no supervisado vía WhatsApp Business Cloud API (los envíos se abren en WhatsApp y se confirman humanamente).
- Facturación electrónica con SUNAT.
- Pasarelas de cobro automáticas integradas (Stripe / Niubiz / MercadoPago).
- Registro público de usuarios (acceso exclusivo para los dos administradores autorizados).
