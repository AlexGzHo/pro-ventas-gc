#!/bin/bash
# Reconstruye la base local igual que producción hoy: stub de Supabase + setup.sql + migraciones v1-v7
# (+ la tabla products, que en producción se creó a mano antes de la v3) + datos ficticios pre-v8.
set -e
source "$(dirname "$0")/env.sh"
psql -d postgres -qc "drop database if exists $DB" -qc "create database $DB"
$P -f "$LOCAL_DIR/00_supabase_stub.sql"
$P -f "$REPO/supabase/setup.sql" 2>&1 | grep -iv notice || true
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  [[ $f == *v3_commercial* ]] && $P -f "$LOCAL_DIR/05_products_pre_v3.sql"
  $P -f "$f" 2>&1 | grep -iv notice || true
done
$P -f "$LOCAL_DIR/10_seed_pre_v8.sql"
