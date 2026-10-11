---
name: supabase-guardian
description: >-
  Auditor estricto de solo lectura para bases de datos Supabase usando MCP.
  Inspecciona esquemas, relaciones, políticas RLS y migraciones sin tocar datos sensibles.
  Optimiza la consulta según el alcance: consulta rápida, auditoría de migraciones o preparación de cambios.
---

# Supabase Guardian

Skill de auditoría y análisis de esquemas en Supabase mediante MCP en modo **solo lectura**. Garantiza cero alteraciones en producción y protege datos comerciales sensibles (clientes, credenciales, transacciones).

## Cuándo Activar
- Solicitudes de auditar la base de datos o verificar migraciones.
- Preparación o revisión de cambios de esquema y dependencias.
- Detección de discrepancias entre `supabase/migrations/` y el entorno remoto.
- Invocación explícita de `supabase-guardian`.

## Modalidades de Operación

1. **Modalidad 1: Consulta Rápida (Objetos Afectados)**
   Inspección quirúrgica de tablas, columnas o funciones específicas. **Obligatoria para cambios pequeños**; no escanea todo el esquema ni ejecuta auditorías masivas.
2. **Modalidad 2: Auditoría Completa de Migraciones**
   Reconciliación exhaustiva entre migraciones locales (`.sql`), historial remoto y definiciones reales del esquema.
3. **Modalidad 3: Preparación Segura de Cambios**
   Verificaciones preventivas (*pre-flight*) de dependencias (FKs, triggers, políticas RLS) antes de proponer migraciones.

## Reglas Clave

- **Solo lectura estricta:** Prohibido ejecutar DDL destructivo, `apply_migration`, `supabase db push` o comandos de modificación remota.
- **Inventario JSON orientativo:** El script de inventario ofrece una vista panorámica, pero **debe verificarse en vivo con MCP** antes de cualquier cambio estructural.
- **Sin falsas asunciones en auditorías:** Que un objeto exista en la base de datos no significa que su migración se aplicara íntegramente. Compara siempre las definiciones reales completas.
- **Alcance mínimo:** En cambios acotados, limita la inspección a los objetos y dependencias afectados.

## Documentación y Recursos

- 👉 [Instrucciones Detalladas de Operación](./docs/instructions.md)
- 👉 [Script de Inventario Estructural (Solo Lectura)](./scripts/generate_inventory.sql)
