# Validación local de la migración multi-revendedor

Entorno para probar migraciones de seguridad **sin tocar Supabase**: un PostgreSQL 16 local que imita lo mínimo de
Supabase (esquema `auth`, `auth.users`, `auth.uid()`, roles `anon`/`authenticated`) y reproduce el estado actual del
proyecto con datos ficticios.

> Esto **no reemplaza** la prueba en staging: el esquema real de producción puede diferir del repositorio
> (por ejemplo, `products` se creó a mano en el panel). Sirve para iterar rápido y para las pruebas de mutación.

## Requisitos

- `psql` y un servidor PostgreSQL 16 local (o en Docker), con usuario `postgres` sin contraseña en local.
- Variables opcionales: `PGHOST` (por defecto `/var/tmp`), `PGPORT` (`5499`), `PGUSER` (`postgres`), `PV_TEST_DB` (`pv`).

Ejemplo con Docker:

```bash
docker run -d --name pv-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5499:5432 postgres:16
```

```bash
PGHOST=localhost supabase/tests/local/run.sh
```

## Scripts

| Script | Qué hace |
|---|---|
| `build.sh` | Crea la base desde cero: stub de Supabase → `supabase/setup.sql` → migraciones v1–v7 (insertando `products` antes de la v3) → datos ficticios pre-v8 (Alex, Liz, clientes, producto, ventas). |
| `run.sh [migración]` | `build.sh` + aplica la migración (por defecto `supabase/drafts/v8_multi_revendedor.sql`) + `supabase/tests/rls_multirevendedor.sql` + `compat.sql`. |
| `mutate.sh` | Pruebas de mutación: introduce 9 agujeros de seguridad a propósito y comprueba que cada uno hace fallar alguna prueba. `MIG=ruta` para probar otra migración. |
| `compat.sql` | Simula lo que hace **hoy** el frontend (sin cambios) con las sesiones de Alex y Liz tras la migración. |

## Resultado esperado

- `run.sh`: `TODAS LAS PRUEBAS PASARON (1-19)` y, en compatibilidad, `venta creada` y `venta de Liz creada`.
- `mutate.sh`: "Sin mutación" → `PASARON`; M1–M9 → `FALLO n`. Una mutación que termine en `PASARON` significa que
  las pruebas ya no detectan ese agujero: hay que añadir o corregir una prueba, **nunca** quitar la mutación.
