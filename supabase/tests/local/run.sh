#!/bin/bash
# Valida la migración multi-revendedor de punta a punta en local.
# Uso: supabase/tests/local/run.sh [ruta_migracion]   (por defecto el borrador v8)
set -e
source "$(dirname "$0")/env.sh"
MIG="${1:-$REPO/supabase/drafts/v8_multi_revendedor.sql}"
echo "1) Reconstruyendo base local (estado actual de producción)…"; "$LOCAL_DIR/build.sh" >/dev/null
echo "2) Aplicando $(basename "$MIG")…"; $P -f "$MIG" 2>&1 | grep -v NOTICE || true
echo "3) Pruebas de seguridad:"; $P -f "$REPO/supabase/tests/rls_multirevendedor.sql" 2>&1 | grep -oE "FALLO.*|TODAS LAS PRUEBAS PASARON.*"
echo "4) Compatibilidad con la app actual (debe listar 'venta creada' y 'venta de Liz creada'):"
$P -tA -f "$LOCAL_DIR/compat.sql" | grep -v '"sub"'
