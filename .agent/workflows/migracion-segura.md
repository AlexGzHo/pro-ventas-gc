---
description: Preparar y probar una migración de Supabase sin tocar producción
---

# /migracion-segura

1. Lee `AGENTS.md` §5 y la spec correspondiente (para multi-revendedor: `docs/specs/02-multi-revendedor.md`).
2. Usa la skill `supabase-guardian` (solo lectura) para obtener el esquema real de producción: tablas, columnas,
   índices, políticas, funciones y grants. Compara con `supabase/schemas/` y `supabase/migrations/` y reporta diferencias.
   Si difieren, la migración se basa en lo real.
3. Consulta la documentación oficial actual de Supabase sobre RLS, `SECURITY DEFINER` y `auth.uid()` y cita las URLs.
4. Escribe la migración en `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql`: idempotente, en una transacción,
   con las políticas viejas eliminadas en la misma transacción que crea las nuevas.
5. Aplica la migración **solo en el proyecto de staging** y ejecuta `supabase/tests/<prueba>.sql`.
   Pega la salida. Todas las pruebas deben pasar; no debilites aserciones para que pasen.
6. Reporta: diferencias de esquema encontradas, migración, resultado de pruebas y el plan de aplicación en producción
   (respaldo previo, orden, verificación posterior, cómo revertir).
7. **Detente.** La aplicación en producción la autoriza el usuario explícitamente y se hace en un paso aparte.
