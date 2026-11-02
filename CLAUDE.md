# PRO VENTAS GC

## Objetivo
PRO VENTAS GC es una aplicación web privada para administrar suscripciones digitales vendidas a clientes. Reemplaza el flujo actual de Excel por una interfaz sencilla para dos usuarios autorizados: el propietario y Liz.

## Stack obligatorio
- Vite
- JavaScript vanilla
- HTML/CSS
- Supabase Auth + PostgreSQL + RLS
- Netlify

No agregar React, Next.js, Express, PHP, ORMs ni frameworks adicionales salvo que exista una necesidad real y se explique antes.

## Principios
- Mantener el proyecto fácil de entender y mantener.
- No cambiar Supabase por otro backend.
- No usar `service_role` ni claves secretas en el frontend.
- No crear registro público de usuarios.
- Ambos usuarios autenticados comparten los mismos registros.
- No automatizar el envío de WhatsApp; solo abrir `wa.me` con el mensaje preparado.
- No eliminar funciones existentes sin confirmación.
- Antes de cambios grandes, inspeccionar los archivos afectados.
- Después de modificar código, ejecutar comprobaciones y `npm run build` cuando las dependencias estén instaladas.

## MVP
Debe incluir:
- Login con correo y contraseña.
- Dashboard.
- Crear, editar y eliminar suscripciones.
- Renovar 7 días, 15 días, 1 mes, 3 meses, 6 meses o 12 meses.
- Buscar y filtrar por servicio y estado.
- Estados automáticos según vencimiento.
- Copiar usuario/correo, contraseña, perfil, PIN y URL.
- Copiar todas las credenciales.
- WhatsApp para recordatorio/cobro, actualización y envío de datos.
- Servicios predefinidos y posibilidad de escribir servicios nuevos.
- Responsive para PC y celular.
- Backend instalable ejecutando `supabase/setup.sql` una sola vez.
- Preparado para Netlify.

## Modelo de datos
Esquema relacional en Supabase (PostgreSQL) con 6 tablas principales e integridad referencial:
1. `public.clients`: Directorio de clientes con nombre, celular (`phone`) y notas.
2. `public.products`: Catálogo de servicios con precios sugeridos, costos sugeridos y categorías.
3. `public.providers`: Directorio de proveedores de servicios con canales de contacto.
4. `public.subscriptions`: Registros de suscripciones asignadas (vinculan cliente, producto, proveedor, credenciales, vigencia, montos y propietario).
5. `public.subscription_renewals`: Historial financiero y control transaccional de renovaciones sucesivas con claves de idempotencia.
6. `public.whatsapp_templates`: Almacenamiento sincronizado de plantillas de mensajería (recordatorio, cobro, actualización, datos).

## Seguridad
- Supabase Auth administra las sesiones.
- RLS está habilitado.
- `anon` no tiene acceso a la tabla.
- Los usuarios autenticados autorizados comparten los registros.
- El registro público debe quedar desactivado en Supabase.
- Las credenciales de las suscripciones se almacenan como datos de la aplicación en esta versión MVP. No registrarlas en logs ni analítica.

## Documentación
Antes de cambiar arquitectura o alcance, revisar:
- `README.md`
- `docs/MVP.md`
- `docs/BACKEND.md`
- `docs/FRONTEND.md`
- `docs/ARQUITECTURA.md`
