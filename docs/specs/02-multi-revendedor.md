# Spec 02 — Multi-revendedor con aislamiento de datos

> Estado: **diseño validado localmente; falta adaptarlo al esquema real y probarlo en staging**.
> Esta spec **sí cambia la base de datos**. Ninguna migración se aplica en producción sin que el dueño lo autorice
> explícitamente después de ver pasar las pruebas de seguridad de la sección 7 en staging.
>
> **Implementación de referencia**: `supabase/drafts/v8_multi_revendedor.sql`. Se validó en un PostgreSQL 16 local que
> reproduce `setup.sql` + migraciones v1–v7 (ver `supabase/tests/local/README.md`):
> - las 19 pruebas de `supabase/tests/rls_multirevendedor.sql` pasan;
> - 9 "mutaciones" (agujeros introducidos a propósito) son detectadas por alguna prueba;
> - la app **actual**, sin cambios, sigue funcionando para Alex y Liz justo después de aplicar la migración
>   (`supabase/tests/local/compat.sql`), así que backend y frontend pueden desplegarse por separado.

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
| `products` tiene **4 políticas superpuestas** (una `FOR ALL` y otras por operación). | La migración debe borrar **todas** las políticas de cada tabla recorriendo `pg_policies`, no por nombre: una sola política vieja permisiva rompe el aislamiento (PostgreSQL las combina con OR). |
| Las migraciones del repo **no reconstruyen la base desde cero**: la v3 hace `ALTER TABLE products` pero `products` se creó a mano en el panel de Supabase y no está en ninguna migración. `setup.sql` solo crea `subscriptions`. | El repo no es fuente fiable del esquema real. Hay que leer producción antes de adaptar la migración, y después dejar `setup.sql` actualizado (requisito del MVP en `CLAUDE.md`). |
| `create_subscription_v3` y `process_renewal`, ante una `idempotency_key` repetida, **devuelven la fila existente antes de comprobar quién llama**. | Con varios revendedores, reutilizar una clave ajena revelaría IDs y montos de otra cuenta. La comprobación de acceso debe ir antes de cualquier respuesta. |
| La función legada `create_subscription` sigue existiendo (no la usa el frontend). | Se elimina; si no, queda como puerta trasera sin controles de dueño. |

> Antes de aplicar la migración, **verificar contra la base real** (solo lectura, skill `supabase-guardian`, modalidad 2)
> que el esquema remoto coincide con lo que asume el borrador. Si difiere, se manda lo remoto.

## 4. Modelo de datos objetivo

### 4.1 Cuentas y `public.profiles`

**El dueño de los datos es una CUENTA, no una persona.** Cada revendedor tiene su cuenta; Alex y Liz comparten la
cuenta de Alex (un solo negocio, un solo catálogo). Así un revendedor podrá tener ayudantes en el futuro.

> Por qué: con "dueño = persona", lo que Liz creara tras la migración quedaría a su nombre y ya no podría usar el
> catálogo común de Alex: **no podría registrar ninguna venta**. Se detectó al validar el borrador y lo cubre la prueba 18.

```
id            uuid  PK, FK → auth.users(id) ON DELETE CASCADE
account_id    uuid  NOT NULL, FK → profiles(id)   -- titular de la cuenta (el titular tiene account_id = id)
display_name  text  NOT NULL
role          text  NOT NULL CHECK (role IN ('admin','reseller')) DEFAULT 'reseller'
is_active     boolean NOT NULL DEFAULT true
created_at    timestamptz NOT NULL DEFAULT now()
```

- Trigger `on auth.users insert` → perfil `reseller`, titular de su propia cuenta, `display_name` = parte local del correo.
- Backfill: perfiles para los usuarios existentes. Alex = `admin`, titular. Liz = **D1** (recomendado: `admin`, en la cuenta de Alex).

### 4.2 Funciones auxiliares (todas `STABLE`, `SECURITY DEFINER`, `SET search_path = ''`)

- `public.current_account()` → cuenta del usuario actual; `null` si no tiene perfil o está desactivado.
- `public.is_admin()` → el perfil de `auth.uid()` es `admin` y está activo.
- `public.is_active_user()` → el perfil de `auth.uid()` existe y está activo.
- `public.can_access(p_owner uuid)` → usuario activo y (`admin` o `p_owner = su cuenta`).
- `public.is_valid_account(p_owner uuid)` → `p_owner` es el titular de una cuenta activa.

Dentro de las políticas se usan como `(select public.is_admin())` y `(select public.current_account())` para que
PostgreSQL las evalúe una vez por consulta y no por fila.

### 4.3 Columna `owner_id` (= cuenta) en las tablas de negocio

`clients`, `products`, `providers`, `subscriptions`, `subscription_renewals`, `whatsapp_templates`:

```
owner_id uuid NOT NULL DEFAULT public.current_account() REFERENCES public.profiles(id)
índice sobre owner_id; inmutable (trigger: no se puede cambiar después de creado)
```

Backfill: **todo lo existente pasa a la cuenta de Alex**. Hoy Alex y Liz comparten catálogo, clientes y proveedores;
repartir por `created_by` mezclaría cuentas dentro de una misma venta y bloquearía editarla. `created_by` se conserva
como dato histórico. La migración termina con una comprobación que **aborta todo** si queda alguna venta, producto o
renovación con cuentas mezcladas.

### 4.4 Integridad entre dueños (obligatorio)

Una venta de un revendedor **no puede** apuntar al cliente, producto o proveedor de otro dueño. Trigger
`BEFORE INSERT OR UPDATE` en `subscriptions` que lance error si `client.owner_id`, `product.owner_id` o
`provider.owner_id` (cuando no son nulos) difieren de `subscriptions.owner_id`. Lo mismo para `products.provider_id`.
`subscription_renewals.owner_id` siempre se copia de su suscripción (nunca del cliente que llama).

### 4.5 Unicidad por dueño

- `products`: único `(owner_id, upper(trim(name)))`.
- `whatsapp_templates`: PK `(owner_id, id)`.

## 5. Políticas RLS (matriz)

Para cada tabla de negocio, cuatro políticas separadas (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), `TO authenticated`.
Regla común `R` = `(select public.is_admin()) OR owner_id = (select public.current_account())`
(`current_account()` es `null` para usuarios desactivados, así que quedan fuera sin regla extra).

| Operación | Regla |
|---|---|
| SELECT | `USING (R)` |
| INSERT | `WITH CHECK (R)` → un revendedor solo inserta en su cuenta; el admin, en cualquiera. |
| UPDATE | `USING (R) WITH CHECK (R)`; además `owner_id` es inmutable (trigger). |
| DELETE | `USING (R)` |

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
| `create_subscription_v3` | Nuevo parámetro opcional `p_owner_id uuid DEFAULT NULL` (cuenta). Si es nulo → `current_account()`. Si es otra cuenta → solo admin, y debe ser una cuenta activa (`is_valid_account`). Cliente, producto y proveedor deben ser de esa cuenta (mismo mensaje de error que si no existieran). **Se borra la firma anterior** (si no, queda una sobrecarga sin controles). Ante `idempotency_key` repetida solo devuelve la fila si es de la misma cuenta. |
| `process_renewal` | Verificar `can_access` sobre la suscripción **antes** de la respuesta idempotente temprana. La renovación hereda `owner_id` de la suscripción (trigger). |
| `delete_subscription_transactional` | Verificar `can_access` sobre la suscripción. |
| `delete_client`, `delete_provider` | Verificar `can_access`. |
| `merge_clients`, `merge_providers` | Verificar `can_access` en ambos y mismo dueño. |
| `create_subscription` (legada) | Eliminarla (el frontend no la usa). |

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
| 16 | R2 actualiza por REST su venta apuntándola al cliente de R3 | Error (trigger de integridad) |
| 17 | Catálogo de funciones `SECURITY DEFINER` | Solo las revisadas, una firma cada una, ninguna ejecutable por `anon`, las de trigger no ejecutables por usuarios |
| 18 | L (admin en la cuenta de A, caso Liz) crea cliente y venta sin indicar dueño | Todo queda en la cuenta de A |
| 19 | R3B (ayudante en la cuenta de R3) | Ve lo de R3, nada de otros; no puede crear a nombre de R2 |

**Pruebas de mutación** (`supabase/tests/local/mutate.sh`): se introducen a propósito 9 agujeros (política vieja
olvidada, renovar sin comprobar dueño, sin trigger de integridad, perfiles editables, inactivo con acceso, anon con
lectura, firma vieja de la RPC, función legada restaurada, dueño = persona). Cada uno debe hacer fallar alguna prueba.
Si se cambia la migración, se vuelven a correr.

## 8. Frontend

- `src/state.js`: cargar el perfil propio al iniciar sesión (`profiles` → `role`, `account_id`, `display_name`). Exponer `state.profile` e `isAdmin()`.
- Eliminar `OWNERS_BY_ID` y toda referencia a "Alex/Liz" fijos. `owner_id` es la **cuenta**: su nombre es el `display_name` del perfil titular (`profiles` donde `id = account_id`). El admin puede leer todos los perfiles; el revendedor solo el suyo.
- **Admin**:
  - Selector de alcance en la barra superior: "Viendo: Todo · Solo mío · <revendedor>". Filtra en el cliente lo que RLS ya entrega (es comodidad, no seguridad).
  - En Nueva venta, campo **"Registrar para"** con las cuentas (perfiles titulares activos); por defecto la cuenta propia. Al cambiarlo, los buscadores de cliente/servicio/proveedor muestran solo los de esa cuenta, y si crea un cliente o servicio en línea lo inserta con `owner_id` = esa cuenta. Se envía como `p_owner_id`.
  - Ajustes → **Revendedores**: lista con nombre, estado (activo/inactivo), n.º de clientes, ventas activas, ingresos y ganancia del mes. Acciones: renombrar y activar/desactivar (UPDATE en `profiles`). Abrir un revendedor = aplicar el selector de alcance a ese revendedor.
  - Alta de revendedores: **no hay registro público**. El admin crea o invita al usuario en el panel de Supabase (Authentication → Users → Add user / Invite). El trigger crea su perfil como revendedor. (Crear usuarios desde la app requeriría una Edge Function con `service_role`; queda fuera de esta fase.)
- **Revendedor**: misma app sin selector de alcance, sin "Registrar para" y sin la pestaña Revendedores.
- Plantillas WhatsApp: cada cuenta edita las suyas; si no tiene, se usan las predeterminadas de `src/whatsapp.js`. El `upsert` actual sigue funcionando (PostgREST usa la PK `(owner_id, id)` y `owner_id` toma su valor por defecto).
- Ningún cambio de UI sustituye a RLS: todas las pruebas de la sección 7 deben pasar aunque se use la API directamente.

## 9. Despliegue

1. Leer el esquema real de producción (solo lectura) y comparar con lo que asume `supabase/drafts/v8_multi_revendedor.sql`.
2. Crear un proyecto Supabase **de pruebas** con ese esquema real (no con las migraciones del repo, que no lo reproducen).
3. Copiar el borrador a `supabase/migrations/<fecha>_v8_multi_revendedor.sql` con los ajustes necesarios, aplicarlo en staging y
   ejecutar `supabase/tests/rls_multirevendedor.sql`: las 19 pruebas en verde. Si se cambió la migración, repetir las mutaciones en local.
4. Probar el frontend contra staging (admin + 2 revendedores de prueba).
5. Solo con autorización del dueño: **respaldo completo de producción**, aplicar la migración, repetir las pruebas 1, 2, 11 y 12 con usuarios reales.
6. Actualizar `supabase/setup.sql`, `docs/ARQUITECTURA.md`, `docs/BACKEND.md` y `CLAUDE.md` (sección Seguridad y Modelo de datos).

## 10. Decisiones abiertas (las responde el dueño antes de empezar)

- **D1. Liz**: ¿admin en la cuenta de Alex (ve y opera todo, como hoy) o revendedora con cuenta propia? *Recomendado: admin en la cuenta de Alex (es lo que hace el borrador).*
- **D2. Catálogo**: ¿cada cuenta tiene su propio catálogo de servicios, o el admin publica un catálogo común (solo nombre y logo, sin costos) que todos pueden usar? *Recomendado ahora: catálogo propio por dueño (más simple y no expone costos). El catálogo común encaja mejor con la fase futura de "cuentas".*
- **D3. Proveedores**: *Recomendado: privados por dueño* (un revendedor nunca ve de dónde compra el admin).

## 11. Fuera de alcance

- Venta de cuentas del admin a revendedores (fase futura; este modelo de `owner_id` la permite añadir después).
- Comisiones, pagos o saldos entre admin y revendedores.
- Registro público o autoservicio de revendedores.
