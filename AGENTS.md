# Reglas de Trabajo para Agentes en PRO VENTAS GC

## Objetivo
Acelerar implementaciones, reducir el consumo de tokens y evitar ciclos repetitivos de diagnóstico, manteniendo la estabilidad y la integridad de la base de datos y la aplicación.

## Flujo de Trabajo y Reglas de Ejecución

1. **Foco en Lectura e Inspección:**
   - Leer únicamente archivos, funciones y dependencias estrictamente relacionados con la solicitud.
   - Consultar `docs/ARCHITECTURE.md` solo cuando sea pertinente; evitar cargar documentación completa innecesariamente.

2. **Estrategia de Backend y Supabase:**
   - Para backend, consultar primero los esquemas declarativos locales (`supabase/migrations/`) y usar Supabase MCP únicamente para verificar información vigente.
   - Activar la skill `supabase-guardian` exclusivamente cuando la tarea requiera auditoría, análisis de dependencias o preparación de cambios sensibles.

3. **Ejecución Autónoma e Directa:**
   - Implementar directamente soluciones de riesgo bajo o medio, sin detenerse en planes o propuestas sucesivas.
   - Resolver autónomamente errores de código, sintaxis y coherencia entre archivos antes de dar por finalizada la tarea.

4. **Restricciones de Entorno y Seguridad:**
   - **No ejecutar comandos costosos o repetitivos** que el usuario prefiera ejecutar personalmente, especialmente `npm run build`.
   - **No ejecutar escrituras en Supabase**, ni `db push`, ni `migration repair`, ni borrados remotos ni operaciones destructivas sin autorización previa explícita.
   - Mantener totalmente intactos los datos financieros, las políticas RLS existentes y los mecanismos de autenticación, salvo solicitud expresa.

5. **Mantenibilidad y Recursos:**
   - Actualizar la documentación técnica (`docs/ARCHITECTURE.md`) únicamente cuando cambien relaciones, contratos, estructura o decisiones arquitectónicas.
   - No incorporar dependencias, frameworks o herramientas nuevas si las existentes resuelven el problema.
   - Utilizar subagentes solo para tareas independientes que brinden una ventaja clara de procesamiento o aislamiento.

6. **Entregables y Reporte:**
   - Entregar funcionalidades completas y código totalmente implementado, no planes pendientes ni funciones a medias. Si existe un bloqueo real que impida finalizar, informar únicamente qué falta para resolverlo.
   - Al finalizar, informar siempre:
     - **Archivos modificados / creados.**
     - **Resultado de la implementación.**
     - **Pruebas manuales imprescindibles.**
