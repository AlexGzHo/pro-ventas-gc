# Reglas de trabajo para agentes en PRO VENTAS GC

Estas reglas aplican a cualquier agente (Antigravity/Gemini, Claude, Codex…). Si una instrucción puntual del usuario
las contradice, se pregunta antes de actuar. `CLAUDE.md` describe el producto; este archivo describe **cómo trabajar**.

## 1. Fuentes de verdad (en este orden)

1. La **spec** de la tarea en `docs/specs/` (qué construir, criterios de aceptación, fuera de alcance).
2. El **código actual** y el **esquema real** de Supabase (se lee, no se supone).
3. `docs/ARQUITECTURA.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`, `CLAUDE.md`.
4. Documentación oficial actual (Supabase, MDN, Vite). **No respondas de memoria** sobre APIs: consulta la documentación
   (MCP de documentación o web) y cita la página cuando la decisión dependa de ella.

Si la spec no cubre algo, **no lo inventes**: detente y pregunta con opciones concretas.

## 2. Flujo obligatorio para cualquier cambio no trivial

1. **Leer**: la spec completa y todos los archivos que vas a tocar, más quienes los importan (`grep` de usos).
2. **Plan escrito** (artefacto de planificación) antes de editar: archivos a crear/modificar/eliminar, contratos
   (funciones exportadas, parámetros, clases CSS, hashes de rutas), riesgos y cómo vas a verificar cada criterio.
   **Espera aprobación del usuario** si el plan toca Supabase, borra archivos o cambia contratos públicos.
3. **Implementar en pasos pequeños**: un lote = un commit. Nada de reescrituras completas de un archivo si basta un cambio puntual.
4. **Verificar** con evidencia (sección 4). No declares algo hecho sin haber ejecutado la comprobación.
5. **Reportar** con el formato de la sección 6.

## 3. Reglas de ingeniería

- **Reutiliza antes de crear**: busca si ya existe una función, componente (`src/ui/`), token o clase que resuelva lo
  mismo. Dos implementaciones de lo mismo = defecto.
- **Un patrón por problema**: modales/paneles en `src/ui/`, estado en `src/state.js`, rutas en `src/router.js`,
  acciones de negocio en `src/features/`, estilos de componentes en `src/styles/components.css`. No mezclar capas.
- **Prohibido editar código con scripts de reemplazo masivo o regex** (sed, scripts Node que reescriben archivos,
  "compactadores"). Edita a mano y revisa el diff. Un script así ya rompió todo el CSS de este proyecto.
- **Nunca "arregles" un error de sintaxis añadiendo llaves o paréntesis al final de un archivo**: busca el bloque abierto.
- **No borres CSS o código "sin uso" sin probarlo** con `npm run verify` y una búsqueda de usos (incluidas clases
  construidas dinámicamente). Ya se perdieron `.hero`, `.toolbar` y los estilos de KPIs así.
- **No agregues dependencias, frameworks ni librerías** (stack obligatorio en `CLAUDE.md`). Si crees que hace falta una,
  propónla con justificación y espera respuesta.
- **No inventes alcance**: nada de temas claros, gráficos, migraciones o "mejoras" que la spec no pida. Lo que creas
  útil, anótalo en el reporte como sugerencia.
- **Errores visibles**: nada de `alert/confirm/prompt`, nada de `console.log` con datos de clientes o credenciales,
  nada de `style=""` en línea (salvo valores dinámicos justificados).

## 4. Verificación obligatoria (evidencia, no promesas)

Antes de cada commit:

```
npm run check            # verify (CSS, tokens, iconos, clases) + tests + build
```

- Si tocaste markup o CSS: `npm run verify -- --strict` sin errores nuevos, y **capturas reales** a 360 px y 1280 px
  de cada pantalla afectada (Playwright/navegador con datos simulados). Mira las capturas antes de reportar.
  No reportes capturas que no generaste o que salieron iguales (mismo tamaño de archivo = sospecha).
- Si tocaste Supabase: ver sección 5.
- Si algo no se pudo verificar, dilo explícitamente. Está prohibido describir como probado algo que no se ejecutó.

## 5. Supabase y seguridad

- **Producción es de solo lectura para agentes**: nada de `apply_migration`, `db push`, `migration repair`, DDL o DML
  remoto sin autorización explícita del usuario **en ese mismo mensaje**.
- Los cambios de esquema se escriben como archivo en `supabase/migrations/` y se prueban primero en el proyecto de
  **staging** con `supabase/tests/*.sql` (todas las pruebas en verde) antes de pedir autorización para producción.
- Para inspeccionar el esquema real usa la skill `supabase-guardian` (solo lectura).
- Toda función `SECURITY DEFINER` ignora RLS: debe validar al inicio usuario activo y dueño de **cada** registro que toca.
- Nunca pidas, guardes ni imprimas tokens de sesión, refresh tokens, contraseñas ni claves. Nunca uses `service_role`
  en el frontend.
- Las capturas con datos reales de clientes no se suben a git (`docs/impeccable/capturas/` está ignorado).

## 6. Formato del reporte final

1. **Qué se hizo**, mapeado a cada criterio de aceptación de la spec (cumplido / no cumplido / no verificable y por qué).
2. **Archivos** creados, modificados y eliminados.
3. **Evidencia**: salida resumida de `npm run check`, rutas de las capturas, resultado de las pruebas SQL si aplica.
4. **Riesgos o dudas** abiertas y sugerencias fuera de alcance (sin implementarlas).
5. **Pruebas manuales** que debe hacer el usuario con su cuenta real.
