# Conexión al PostgreSQL local de pruebas (sobrescribible con variables de entorno).
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$LOCAL_DIR/../../.." && pwd)"
export PGHOST="${PGHOST:-/var/tmp}" PGPORT="${PGPORT:-5499}" PGUSER="${PGUSER:-postgres}"
DB="${PV_TEST_DB:-pv}"
P="psql -d $DB -v ON_ERROR_STOP=1 -q"
