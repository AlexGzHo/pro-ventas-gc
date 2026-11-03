# Spec 02 — Multi-revendedor con aislamiento de datos

> Estado: **diseño aprobado; implementar primero en un proyecto Supabase de pruebas (staging)**.
> Esta spec **sí cambia la base de datos**. Ninguna migración se aplica en producción sin que el dueño lo autorice
> explícitamente después de ver pasar las pruebas de seguridad de la sección 7 en staging.

## 1. Objetivo

- El **admin** (dueño) ve y gestiona todo: sus propios datos y los de cada revendedor.
- Cada **revendedor** ve y gestiona **solo** sus propios clientes, ventas, catálogo, proveedores y plantillas.
- Un revendedor **no** ve los datos del admin ni los de otros revendedores, ni siquiera que existen.
- El admin puede **registrar una venta a nombre de un revendedor** (p. ej. "vendo un Disney+ para el revendedor 3").
- Base preparada para la fase futura de "cuentas" (inventario del admin que los revendedores compran), sin implementarla.

## 2. ¿Es viable? Sí, con RLS de PostgreSQL

Supabase aplica Row Level Security en el servidor: aunque alguien modifique el frontend o llame a la API a mano con su
sesión, PostgreSQL solo le devuelve las filas que la política permite. **La seguridad no puede depender del frontend.**
Ocultar botones o filtrar en JavaScript no es aislamiento.

## 3. Estado actual (verificado en el repositorio)

| Hallazgo | Consecuencia |
|---|---|
| Las políticas RLS de las 6 tablas permiten acceso a **dos UUID fijos** (Alex y Liz) escritos en el SQL. | Hoy no existe el concepto de dueño de un registro: ambos ven todo. Hay que reemplazar todas las políticas. |
| ~8 funciones `SECURITY DEFINER` (`create_subscription_v3`, `process_renewal`, `delete_subscription_transactional`, `delete_client`, `merge_clients`, `delete_provider`, `merge_providers`, `create_subscription`) validan con esos mismos UUID fijos. | **Riesgo principal**: `SECURITY DEFINER` **ignora RLS**. Si no se reescriben con comprobaciones de dueño, un revendedor podría renovar, borrar o fusionar datos ajenos llamando a la RPC con un ID ajeno. |
| `clients` y `subscriptions` tienen `created_by` (default `auth.uid()`); `products`, `providers`, `subscription_renewals` y `whatsapp_templates` no tienen columna de dueño. | Hay que añadir `owner_id` y rellenarla (backfill). |
| `products` tiene índice único global por nombre (`upper(trim(name))`). | Dos revendedores no podrían tener "Netflix" a la vez. Pasa a ser único **por dueño**. |
| `whatsapp_templates` usa `id` fijo (`reminder`, `credentials`, `update`) como clave primaria global. | Pasa a clave `(owner_id, id)`; quien no tenga plantillas propias usa las predeterminadas del frontend. |
| Frontend: `OWNERS_BY_ID` en `src/constants.js` y filtro "Propietario: Alex / Liz". | Se reemplaza por datos de `profiles`. |
| `anon` tiene GRANT sobre las tablas (lo bloquea solo RLS). | Defensa en profundidad: revocar a `anon`. |

> Antes de diseñar la migración, **verificar contra la base real** (solo lectura, skill `supabase-guardian`, modalidad 2)
> que el esquema remoto coincide con `supabase/schemas/` y `supabase/migrations/`. Si difiere, se manda lo remoto.

## 4. Modelo de datos objetivo

### 4.1 `public.profiles`

```
id            uuid  PK, FK → auth.users(id) ON DELETE CASCADE
display_name  text  NOT NULL
role          text  NOT NULL CHECK (role IN ('admin','reseller')) DEFAULT 'reseller'
is_active     boolean NOT NULL DEFAULT true
created_at    timestamptz NOT NULL DEFAULT now()
```

- Trigger `on auth.users insert` → crea el perfil con `role = 'reseller'` y `display_name` = parte local del correo.
- Backfill: perfiles para los usuarios existentes. Alex = `admin`. Liz = **ver decisión D1**.

### 4.2 Funciones auxiliares (todas `STABLE`, `SECURITY DEFINER`, `SET search_path = ''`, sin parámetros manipulables)

- `public.is_admin()` → `true` si el perfil de `auth.uid()` es `admin` y está activo.
- `public.is_active_user()` → `true` si el perfil de `auth.uid()` existe y está activo.
- `public.can_access(p_owner uuid)` → `is_active_user() AND (p_owner = auth.uid() OR is_admin())`.

Usar `(select auth.uid())` y `(select public.is_admin())` dentro de las políticas para que PostgreSQL las evalúe una vez por consulta (rendimiento).

### 4.3 Columna `owner_id` en las tablas de negocio

`clients`, `products`, `providers`, `subscriptions`, `subscription_renewals`, `whatsapp_templates`:

```
owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id)
índice sobre owner_id
```

Backfill: `clients`/`subscriptions` desde `created_by`; `subscription_renewals` desde su suscripción; `products`,
`providers` y `whatsapp_templates` existentes → admin. Si `created_by` es nulo → admin.

### 4.4 Integridad entre dueños (obligatorio)

Una venta de un revendedor **no puede** apuntar al cliente, producto o proveedor de otro dueño. Trigger
`BEFORE INSERT OR UPDATE` en `subscriptions` que lance error si `client.owner_id`, `product.owner_id` o
`provider.owner_id` (cuando no son nulos) difieren de `subscriptions.owner_id`. Lo mismo para `products.provider_id`.
`subscription_renewals.owner_id` siempre se copia de su suscripción (nunca del cliente que llama).

### 4.5 Unicidad por dueño

- `products`: único `(owner_id, upper(trim(name)))`.
- `whatsapp_templates`: PK `(owner_id, id)`.

## 5. Políticas RLS (matriz)

Para cada tabla de negocio, cuatro políticas separadas (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), `TO authenticated`:

| Operación | Regla |
|---|---|
| SELECT | `public.can_access(owner_id)` |
| INSERT | `WITH CHECK (public.can_access(owner_id))` → un revendedor solo puede insertar con su propio `owner_id`; el admin puede insertar para cualquiera. |
| UPDATE | `USING (public.can_access(owner_id)) WITH CHECK (public.can_access(owner_id))` → impide "regalar" un registro a otro dueño. |
| DELETE | `public.can_access(owner_id)` |

Excepciones:
- `subscription_renewals`: se mantienen bloqueados INSERT/UPDATE/DELETE por REST (solo vía RPC); SELECT con `can_access`.
- `profiles`: SELECT propio (`id = auth.uid()`) o admin ve todos. UPDATE solo admin (ningún revendedor puede cambiar su `role` ni `is_active`). INSERT/DELETE solo por trigger / panel de Supabase.

Eliminar **todas** las políticas antiguas con UUID fijos (PostgreSQL combina políticas permisivas con OR: si queda una vieja, el aislamiento se rompe). `REVOKE ALL ... FROM anon` en las 7 tablas.

## 6. Funciones RPC: reescritura obligatoria

Cada función `SECURITY DEFINER` debe, **al inicio**:
1. Rechazar si `auth.uid()` es nulo o `NOT public.is_active_user()`.
2. Cargar los registros que va a tocar **con `FOR UPDATE`** y verificar `public.can_access(owner_id)` en **cada uno**.
3. En operaciones con dos registros (`merge_clients`, `merge_providers`) exigir además que **ambos tengan el mismo `owner_id`**.

| Función | Cambio |
|---|---|
| `create_subscription_v3` | Nuevo parámetro opcional `p_owner_id uuid DEFAULT NULL`. Si es nulo → `auth.uid()`. Si es distinto de `auth.uid()` → solo permitido a admin. Verificar que cliente, producto y proveedor pertenecen a ese dueño. La renovación inicial hereda el `owner_id`. Mantener idempotencia. |
| `process_renewal` | Verificar `can_access` sobre la suscripción. La renovación hereda `owner_id` de la suscripción. |
| `delete_subscription_transactional` | Verificar `can_access` sobre la suscripción. |
| `delete_client`, `delete_provider` | Verificar `can_access`. |
| `merge_clients`, `merge_providers` | Verificar `can_access` en ambos y mismo dueño. |
| `create_subscription` (legada) | Si el frontend ya no la usa, eliminarla o aplicarle las mismas reglas. No dejar una puerta trasera. |

Además: `REVOKE EXECUTE ... FROM anon, public` y `GRANT EXECUTE ... TO authenticated` en cada función.

## 7. Pruebas de seguridad (deben pasar en staging antes de producción)

Archivo: `supabase/tests/rls_multirevendedor.sql`. Se ejecuta en una transacción que termina en `ROLLBACK`, simulando
usuarios con `set local role authenticated` y `set_config('request.jwt.claims', ...)`. Escenario: admin A,
revendedores R2 y R3, revendedor inactivo R4, cada uno con un cliente, producto, proveedor y venta.

| # | Prueba | Esperado |
|---|---|---|
| 1 | R2 hace SELECT en cada tabla | Solo filas con `owner_id = R2` |
| 2 | R2 busca por ID una fila de R3 o de A | 0 filas |
| 3 | R2 inserta con `owner_id = R3` | Error de RLS |
| 4 | R2 actualiza su fila poniendo `owner_id = R3` | Error de RLS |
| 5 | R2 llama `create_subscription_v3` con el cliente de R3 | Error |
| 6 | R2 llama `create_subscription_v3` con `p_owner_id = R3` | Error |
| 7 | R2 llama `process_renewal` / `delete_subscription_transactional` sobre la venta de R3 | Error, sin cambios |
| 8 | R2 llama `merge_clients` con un cliente propio y uno de R3 | Error |
| 9 | R2 actualiza su propio `profiles.role` a `admin` | 0 filas / error |
| 10 | R4 (inactivo) hace SELECT | 0 filas en todo |
| 11 | `anon` hace SELECT | Error de permisos |
| 12 | A hace SELECT | Ve las filas de A, R2, R3 y R4 |
| 13 | A crea venta con `p_owner_id = R3` usando cliente/producto de R3 | OK, `owner_id = R3` |
| 14 | A crea venta para R3 con el cliente de R2 | Error (integridad entre dueños) |
| 15 | R2 SELECT en `subscription_renewals` | Solo renovaciones de sus ventas |

## 8. Frontend

- `src/state.js`: cargar el perfil propio al iniciar sesión (`profiles` → `role`, `display_name`). Exponer `state.profile` e `isAdmin()`.
- Eliminar `OWNERS_BY_ID` y toda referencia a "Alex/Liz" fijos. El nombre del dueño de una fila sale de `profiles` (el admin puede leerlos todos; el revendedor solo el suyo).
- **Admin**:
  - Selector de alcance en la barra superior: "Viendo: Todo · Solo mío · <revendedor>". Filtra en el cliente lo que RLS ya entrega (es comodidad, no seguridad).
  - En Nueva venta, campo **"Registrar para"** (por defecto el propio admin). Al cambiarlo, los buscadores de cliente/servicio/proveedor muestran solo los de ese dueño. Se envía como `p_owner_id`.
  - Ajustes → **Revendedores**: lista con nombre, estado (activo/inactivo), n.º de clientes, ventas activas, ingresos y ganancia del mes. Acciones: renombrar y activar/desactivar (UPDATE en `profiles`). Abrir un revendedor = aplicar el selector de alcance a ese revendedor.
  - Alta de revendedores: **no hay registro público**. El admin crea o invita al usuario en el panel de Supabase (Authentication → Users → Add user / Invite). El trigger crea su perfil como revendedor. (Crear usuarios desde la app requeriría una Edge Function con `service_role`; queda fuera de esta fase.)
- **Revendedor**: misma app sin selector de alcance, sin "Registrar para" y sin la pestaña Revendedores.
- Plantillas WhatsApp: cada usuario edita las suyas; si no tiene, se usan las predeterminadas de `src/whatsapp.js`.
- Ningún cambio de UI sustituye a RLS: todas las pruebas de la sección 7 deben pasar aunque se use la API directamente.

## 9. Despliegue

1. Crear un proyecto Supabase **de pruebas** (o una rama de Supabase) y reproducir el esquema actual desde `supabase/`.
2. Escribir la migración en `supabase/migrations/<fecha>_v8_multi_revendedor.sql`, idempotente, en este orden:
   perfiles y trigger → funciones auxiliares → columnas `owner_id` + backfill + `NOT NULL` → integridad y unicidad
   → políticas nuevas (borrando las viejas en la **misma transacción**) → RPCs reescritas → revokes.
3. Ejecutar `supabase/tests/rls_multirevendedor.sql` en staging: las 15 pruebas en verde.
4. Probar el frontend contra staging (admin + 2 revendedores de prueba).
5. Solo con autorización del dueño: **respaldo completo de producción**, aplicar la migración, repetir las pruebas 1, 2, 11 y 12 con usuarios reales.
6. Actualizar `supabase/setup.sql`, `docs/ARQUITECTURA.md`, `docs/BACKEND.md` y `CLAUDE.md` (sección Seguridad y Modelo de datos).

## 10. Decisiones abiertas (las responde el dueño antes de empezar)

- **D1. Liz**: ¿admin (ve todo, como hoy) o revendedora? *Recomendado: admin, para no cambiar lo que ve hoy.*
- **D2. Catálogo**: ¿cada revendedor tiene su propio catálogo de servicios, o el admin publica un catálogo común (solo nombre y logo, sin costos) que todos pueden usar? *Recomendado ahora: catálogo propio por dueño (más simple y no expone costos). El catálogo común encaja mejor con la fase futura de "cuentas".*
- **D3. Proveedores**: *Recomendado: privados por dueño* (un revendedor nunca ve de dónde compra el admin).

## 11. Fuera de alcance

- Venta de cuentas del admin a revendedores (fase futura; este modelo de `owner_id` la permite añadir después).
- Comisiones, pagos o saldos entre admin y revendedores.
- Registro público o autoservicio de revendedores.
