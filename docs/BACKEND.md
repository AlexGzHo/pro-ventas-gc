# Backend

## Tecnología
El backend es Supabase. Se utilizan tres piezas de Supabase:

- Auth: inicio de sesión de los dos usuarios.
- PostgreSQL: almacenamiento de suscripciones.
- Row Level Security: bloqueo de acceso a visitantes sin sesión.

No existe un servidor Node/Express adicional.

## Instalación
1. Crear un proyecto en Supabase.
2. Abrir SQL Editor.
3. Copiar todo `supabase/setup.sql`.
4. Ejecutarlo una sola vez.
5. Crear manualmente los dos usuarios en Authentication > Users.
6. Desactivar nuevos registros públicos en la configuración de Authentication.
7. Copiar la URL y la Publishable Key del proyecto.
8. Pegarlas en `.env` durante desarrollo y en las variables de entorno de Netlify durante producción.

## Tabla principal
`public.subscriptions`

La tabla mantiene una estructura universal para evitar una tabla diferente por cada aplicación.

Campos:
- `id`: UUID.
- `client_name`: nombre del cliente.
- `phone`: celular del cliente.
- `service`: nombre del servicio.
- `username_email`: correo o usuario.
- `password`: contraseña de acceso.
- `profile`: perfil cuando aplique.
- `pin`: PIN cuando aplique.
- `access_url`: URL cuando aplique.
- `sale_price`: precio cobrado.
- `cost`: costo del proveedor.
- `provider`: proveedor.
- `start_date`: inicio.
- `expiry_date`: vencimiento del cliente.
- `provider_expiry_date`: vencimiento con proveedor.
- `extras`: JSON para datos no previstos.
- `notes`: observaciones internas.
- `created_by`: usuario de Supabase que creó el registro.
- `created_at`: fecha de creación.
- `updated_at`: última modificación.

## Servicios nuevos
No requieren cambios de base de datos. El usuario escribe el nuevo servicio en el formulario. Si necesita un dato no estándar, se guarda en `extras`.

Ejemplo:

```text
Plan: Plus
Dispositivos: 2
Servidor: Principal
```

se transforma en JSON.

## Seguridad MVP
`setup.sql` habilita RLS y revoca acceso a `anon`. La política de `subscriptions` no acepta a cualquier autenticado: exige que `auth.uid()` esté en la lista de los dos usuarios autorizados (tú y Liz, UUIDs escritos en el SQL). Así, aunque exista otra cuenta en Supabase Auth, no podrá leer ni modificar la tabla. La condición no es `true`, por lo que el Security Advisor tampoco marca la política como "RLS Policy Always True".

Si la política se ejecutara con los UUIDs sin reemplazar, el acceso queda cerrado para todos (fail closed), no abierto.

No se usa ninguna función `SECURITY DEFINER` relacionada con el acceso: `public.set_updated_at()` es un trigger que solo actualiza `updated_at` y no consulta ni expone filas. Por lo tanto no crea una vía alternativa de lectura de `subscriptions`.

No se debe colocar una clave `service_role` en `.env`, JavaScript o Netlify. El navegador utiliza solamente la Publishable Key/Anon Key junto con la sesión de Supabase.

## Credenciales almacenadas
El MVP guarda las credenciales de los servicios dentro de la base protegida por Auth + RLS para mantener el sistema sencillo. No deben enviarse a herramientas de analítica ni imprimirse en logs. Si en una versión posterior se requiere cifrado de aplicación para esos campos, puede añadirse sin cambiar la interfaz principal.
