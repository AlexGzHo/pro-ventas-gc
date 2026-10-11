-- supabase-guardian
-- Inventario estructural del esquema public.
-- Solo lectura: no consulta registros comerciales.

WITH tables_info AS (
    SELECT
        c.oid,
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
)
SELECT jsonb_build_object(
    'generated_at', now(),
    'schema', 'public',

    'tables', COALESCE((
        SELECT jsonb_object_agg(
            t.table_name,
            jsonb_build_object(
                'columns', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'name', a.attname,
                            'type', format_type(
                                a.atttypid, a.atttypmod
                            ),
                            'nullable', NOT a.attnotnull,
                            'default',
                                pg_get_expr(
                                    d.adbin, d.adrelid
                                ),
                            'identity', a.attidentity,
                            'generated', a.attgenerated
                        )
                        ORDER BY a.attnum
                    ), '[]'::jsonb)
                    FROM pg_catalog.pg_attribute a
                    LEFT JOIN pg_catalog.pg_attrdef d
                      ON d.adrelid = a.attrelid
                     AND d.adnum = a.attnum
                    WHERE a.attrelid = t.oid
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                ),

                'constraints', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'name', con.conname,
                            'type', con.contype,
                            'definition',
                                pg_get_constraintdef(con.oid)
                        )
                        ORDER BY con.conname
                    ), '[]'::jsonb)
                    FROM pg_catalog.pg_constraint con
                    WHERE con.conrelid = t.oid
                ),

                'indexes', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'name', i.indexname,
                            'definition', i.indexdef
                        )
                        ORDER BY i.indexname
                    ), '[]'::jsonb)
                    FROM pg_catalog.pg_indexes i
                    WHERE i.schemaname = 'public'
                      AND i.tablename = t.table_name
                ),

                'triggers', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'name', tr.tgname,
                            'definition',
                                pg_get_triggerdef(tr.oid)
                        )
                        ORDER BY tr.tgname
                    ), '[]'::jsonb)
                    FROM pg_catalog.pg_trigger tr
                    WHERE tr.tgrelid = t.oid
                      AND NOT tr.tgisinternal
                ),

                'rls_enabled', t.rls_enabled,
                'rls_forced', t.rls_forced,

                'rls_policies', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'name', p.policyname,
                            'command', p.cmd,
                            'permissive', p.permissive,
                            'roles', p.roles,
                            'using', p.qual,
                            'with_check', p.with_check
                        )
                        ORDER BY p.policyname
                    ), '[]'::jsonb)
                    FROM pg_catalog.pg_policies p
                    WHERE p.schemaname = 'public'
                      AND p.tablename = t.table_name
                )
            )
        )
        FROM tables_info t
    ), '{}'::jsonb),

    'functions', COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'name', p.proname,
                'arguments',
                    pg_get_function_identity_arguments(p.oid),
                'returns', pg_get_function_result(p.oid),
                'security_definer', p.prosecdef
            )
            ORDER BY p.proname,
                     pg_get_function_identity_arguments(p.oid)
        )
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n
          ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
    ), '[]'::jsonb)
) AS structural_inventory;
