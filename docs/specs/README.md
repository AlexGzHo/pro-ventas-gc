# Plan de trabajo: reorganización + multi-revendedor

| Documento | Qué define |
|---|---|
| [`01-reorganizacion-ux.md`](01-reorganizacion-ux.md) | Nueva navegación, patrón único de panel lateral, Nueva venta sin saltos, sistema visual uniforme. Solo frontend. |
| [`02-multi-revendedor.md`](02-multi-revendedor.md) | Roles admin/revendedor, aislamiento con RLS, reescritura de RPCs, pruebas de seguridad, despliegue. |
| `../../AGENTS.md` | Cómo debe trabajar cualquier agente (plan, verificación, seguridad, reporte). |
| `../../.agent/rules/`, `../../.agent/workflows/` | Reglas y comandos (`/implementar-lote`, `/verificar`, `/migracion-segura`) que Antigravity carga solo. |
| `../../scripts/verify/` | Verificadores automáticos (`npm run verify`, `npm run check`). |
| `../../supabase/drafts/v8_multi_revendedor.sql` | Migración de referencia de la Spec 02, **validada en local** (no aplicar tal cual). |
| `../../supabase/tests/rls_multirevendedor.sql` | Las 19 pruebas de aislamiento que deben pasar en staging. |
| `../../supabase/tests/local/` | PostgreSQL local que reproduce el proyecto: `run.sh` (validación) y `mutate.sh` (pruebas de mutación). |

## Fases

| Fase | Qué | Dónde | Quién aprueba |
|---|---|---|---|
| A | Lote B0 de la Spec 01: restaurar CSS perdido y unificar tokens/componentes. Dejar `npm run verify -- --strict` en verde. | `src/styles/` | Revisión de Claude |
| B | Spec 01, lotes B1–B6 (en paralelo según la tabla de la spec). | `src/` | Revisión de Claude + prueba del dueño |
| C | Spec 02 backend: adaptar el borrador v8 al esquema **real** de producción y probarlo **en staging**. Puede ir en paralelo con B (solo toca `supabase/`). | `supabase/` | Revisión de Claude |
| D | Spec 02 frontend: perfil, selector de alcance, "Registrar para", pestaña Revendedores. | `src/` | Revisión de Claude + prueba del dueño |
| E | Aplicar en producción: respaldo, migración, pruebas con usuarios reales. | Supabase prod | **El dueño, explícitamente** |

Antes de la fase C, el dueño responde las decisiones D1–D3 de la Spec 02.

## Configuración de Antigravity (una vez)

1. **Modelo**: el Gemini de mayor razonamiento disponible, con el razonamiento/"thinking" en el nivel más alto.
2. **Modo**: *Planning* (no *Fast*). Así produce un plan como artefacto y lo puedes revisar antes de que edite.
3. **Revisión de artefactos**: que pida revisión del plan antes de ejecutar (no "proceder siempre").
4. **Terminal**: que pida confirmación para comandos que escriban fuera del repo o hablen con servicios remotos.
5. **MCP servers**:
   - **Supabase MCP de producción en modo solo lectura** (`--read-only`), para inspeccionar el esquema real.
   - **Supabase MCP de staging** (otro proyecto) con escritura, para probar migraciones.
   - **Documentación actual** (p. ej. Context7 o el buscador web integrado), para que consulte la API vigente de
     Supabase/MDN en lugar de responder de memoria.
   - **Navegador** (el integrado de Antigravity o Playwright) para capturas reales.
6. Las reglas de `.agent/rules/proventas.md` se cargan solas; los flujos se invocan con `/implementar-lote`, `/verificar`
   y `/migracion-segura`.

## Prompts por fase

### Fase A

```
/implementar-lote 01 B0
Contexto: el refactor borró CSS que sí se usaba (.hero, .toolbar, .filter-controls, kpi-*, inicio-bar-*, etc.).
`npm run verify` lista hoy ~100 clases sin estilos. Objetivo del lote: restaurarlas usando como referencia
`git show origin/main:src/styles.css`, adaptadas a los tokens, y definir los tokens y componentes únicos de la
sección 4 de la spec. Las clases que sean solo ganchos de JS van a scripts/verify/class-hooks.txt con un comentario.
Criterio de cierre: `npm run verify -- --strict` en verde y capturas 360/1280 de Inicio, Clientes, Catálogo,
Proveedores y Plantillas.
```

### Fase B (después de A)

```
Implementa la Spec 01 (docs/specs/01-reorganizacion-ux.md), lotes B1 a B6, respetando la tabla de dependencias.
Usa subagentes en paralelo solo para lotes que no comparten archivos (B2, B3, B4 y B6 tras B1).
Para cada lote ejecuta /implementar-lote 01 <lote>. Un lote = un commit. Al final ejecuta /verificar y entrégame
el reporte con los 7 criterios de aceptación de la spec mapeados uno por uno.
```

### Fase C (en paralelo con B, tras responder D1–D3)

```
/migracion-segura
Spec: docs/specs/02-multi-revendedor.md. Decisiones del dueño: D1=<…>, D2=<…>, D3=<…>.
Punto de partida: supabase/drafts/v8_multi_revendedor.sql (ya validado en local con 19 pruebas y 9 mutaciones).
1. Lee el esquema REAL de producción con supabase-guardian (solo lectura) y lista cada diferencia con lo que asume
   el borrador (tablas, columnas, índices, TODAS las políticas, funciones y sus firmas, grants, triggers).
2. Ajusta una copia en supabase/migrations/<fecha>_v8_multi_revendedor.sql solo donde el esquema real lo exija;
   explica cada cambio. No cambies el modelo (cuentas, reglas RLS, controles en RPC) sin preguntarme.
3. Aplícala en STAGING y ejecuta supabase/tests/rls_multirevendedor.sql: 19 pruebas en verde. No debilites aserciones.
4. Si modificaste la migración, ejecuta supabase/tests/local/mutate.sh con MIG=<tu migración> (o pídeme que lo haga).
5. Entrégame: diferencias encontradas, diff contra el borrador, salida de las pruebas y plan de producción
   (respaldo, aplicación, verificación, reversión). No toques producción.
```

### Fase D (después de B y C)

```
Implementa la sección 8 (Frontend) de docs/specs/02-multi-revendedor.md contra el proyecto de staging.
Sigue /implementar-lote. Verifica con 3 sesiones de prueba en staging (admin, revendedor R2, revendedor R3) que:
R2 no ve nada de R3 ni del admin, el admin ve todo, el selector de alcance filtra y "Registrar para" crea la venta
a nombre del revendedor elegido. Capturas de cada rol a 360/1280.
```

## Cómo revisar cada entrega

Después de cada push, pide a Claude que revise el commit: lee el diff, ejecuta `npm run check`, renderiza con datos
simulados y compara con los criterios de la spec. No se avanza de fase con criterios en rojo.
