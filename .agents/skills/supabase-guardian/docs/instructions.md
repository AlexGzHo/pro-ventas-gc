# Instrucciones de Operación: Supabase Guardian

Protocolo de inspección para Supabase mediante MCP (`execute_sql`, `list_migrations`). Diseñado para máxima fidelidad estructural, mínimo consumo de tokens y protección absoluta de datos comerciales.

---

## Reglas Generales de Seguridad y Alcance

1. **Modo Solo Lectura:** Jamás ejecutes sentencias DDL/DML que modifiquen esquemas o registros (`ALTER`, `DROP`, `UPDATE`, `INSERT`, `DELETE`).
2. **Protección de Datos:** Nunca consultes ni extraigas datos comerciales de las tablas (información de clientes, credenciales, transacciones). Consulta únicamente catálogos del sistema (`pg_catalog`, `information_schema`).
3. **No Auditar de Más:** Para cambios pequeños o consultas puntuales, evita auditorías completas; inspecciona exclusivamente los objetos y dependencias afectados.
4. **Inventario JSON como Referencia Orientativa:** El archivo [`../scripts/generate_inventory.sql`](../scripts/generate_inventory.sql) produce un mapa estructural general. Es útil para orientación contextual, pero **siempre debe verificarse el estado en vivo mediante MCP** antes de planificar o aplicar cambios estructurales.

---

## Modalidades de Operación

### Modalidad 1: Consulta Rápida (Objetos Afectados)
Aplica cuando la tarea involucra tablas, vistas o funciones específicas, o cambios pequeños.
- **Acción:** Ejecuta una consulta focalizada vía `execute_sql` filtrando estrictamente por el objeto de interés.
- **Alcance típico:**
  - Columnas y tipos de datos: `information_schema.columns` o `pg_attribute`.
  - Restricciones y claves: `pg_constraint`.
  - Políticas RLS: `pg_policies`.
  - Índices y triggers: `pg_indexes`, `pg_trigger`.
- **Ejemplo:** Inspección de una tabla específica consolidando sus propiedades en una sola llamada SQL para ahorrar tokens.

### Modalidad 2: Auditoría Completa de Migraciones
Aplica cuando se requiere validar la consistencia global entre el código local y el estado de la base remota.
1. **Inspección Local:** Revisa los archivos en `supabase/migrations/` (marcas de tiempo, orden secuencial, sintaxis y contenido DDL).
2. **Historial Remoto:** Consulta las migraciones registradas mediante `list_migrations` o `SELECT version FROM supabase_migrations.schema_migrations`.
3. **Verificación Estructural Real:** Compara las definiciones efectivas en la base de datos contra el DDL local.
   - ⚠️ **Principio de Integridad:** **No supongas que un objeto existente demuestra que toda una migración fue aplicada.** Una tabla puede existir por una migración previa, ejecución manual o intento parcial fallido. Valida columnas, restricciones, índices y RLS antes de calificar una migración como aplicada o sincronizada.

### Modalidad 3: Preparación Segura de Cambios
Aplica antes de redactar nuevas migraciones o proponer cambios de esquema (*pre-flight checks*).
1. **Mapeo de Dependencias:** Identifica claves foráneas (`pg_constraint` tipo `'f'`), triggers activos, funciones que referencien la tabla y políticas RLS existentes.
2. **Verificación en Vivo:** Aunque consultes el inventario JSON para ubicación general, valida en vivo con MCP los objetos y dependencias que serán modificados.
3. **Generación de Artefactos Seguros:** No apliques cambios en la base de datos remota. Presenta las recomendaciones o el script de migración local al usuario para su revisión y despliegue controlado.

---

## Uso del Script de Inventario Estructural

- **Ubicación:** [`../scripts/generate_inventory.sql`](../scripts/generate_inventory.sql)
- **Propósito:** Generar un JSON con tablas, columnas, tipos, restricciones, índices, triggers, estado RLS y funciones del esquema `public`.
- **Ejecución:** Envíalo mediante `execute_sql` únicamente cuando requieras una vista panorámica del esquema. Recuerda que no extrae registros de tablas ni información sensible.
