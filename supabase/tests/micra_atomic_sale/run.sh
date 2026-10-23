#!/usr/bin/env bash
# Prueba micra_record_sale / micra_void_sale contra un Postgres desechable
# (nunca la base real): crea la base micra_sale_test, aplica la réplica del
# esquema y la migración, corre las pruebas secuenciales y las de concurrencia
# (dos sesiones a la vez) y borra la base.
#
# Usa las variables estándar de psql (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# Ejemplo: PGHOST=localhost PGUSER=postgres npm run test:sql
set -euo pipefail
case "${PGHOST:-}" in *supabase*) echo "PGHOST apunta a Supabase: usa un Postgres local desechable." >&2; exit 1 ;; esac
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
DB=micra_sale_test
ADMIN=(psql -X -q -v ON_ERROR_STOP=1 -d postgres)
T=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
Q=(psql -X -qtA -v ON_ERROR_STOP=1 -d "$DB")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; "${ADMIN[@]}" -c "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT
"${ADMIN[@]}" -c "set client_min_messages = warning" -c "drop database if exists $DB" -c "create database $DB"
"${T[@]}" -f "$HERE/schema.sql"
"${T[@]}" -f "$ROOT/supabase/migrations/20261021120000_micra_atomic_sale.sql"
"${T[@]}" -f "$ROOT/supabase/migrations/20261022120000_micra_street_study.sql"
"${T[@]}" -f "$HERE/test_street.sql"
"${T[@]}" -f "$ROOT/supabase/migrations/20261022140000_tintero_surveys.sql"
"${T[@]}" -f "$ROOT/supabase/migrations/20261023160000_survey_offer_choice.sql"
"${T[@]}" -f "$HERE/test_surveys.sql"
"${T[@]}" -f "$HERE/seed.sql"
"${T[@]}" -f "$HERE/test.sql"

# Concurrencia: la sesión A abre la transacción y espera; B llega mientras tanto
AS_ADMIN="set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';"
V250="'20000000-0000-0000-0000-000000000250'"
L='[{"variant_id":"20000000-0000-0000-0000-000000000250","qty":1}]'
stock() { "${Q[@]}" -c "select stock_qty from inventory where variant_id = $V250"; }
pair() { # $1 = sentencia de A (dentro de la transacción), $2 = sentencia de B
  ( echo "$AS_ADMIN"; echo "begin; $1; select pg_sleep(1.5); commit;" ) | "${Q[@]}" > "$TMP/a" &
  sleep 0.4
  ( echo "$AS_ADMIN"; echo "$2;" ) | "${Q[@]}" > "$TMP/b"
  wait
}
check() { if [ "$2" != "$3" ]; then echo "✗ $1: esperado $3, salió $2" >&2; exit 1; fi; echo "✓ $1"; }

"${Q[@]}" -c "update inventory set stock_qty = 5 where variant_id = $V250"
pair "select micra_record_sale('$L', 'cash', null, 'conc-ref-1')->>'replay'" "select micra_record_sale('$L', 'cash', null, 'conc-ref-1')->>'replay'"
check "mismo client_ref a la vez: A crea" "$(grep -E '^(true|false)$' "$TMP/a")" false
check "mismo client_ref a la vez: B recibe el mismo" "$(grep -E '^(true|false)$' "$TMP/b")" true
check "un solo pedido" "$("${Q[@]}" -c "select count(*) from orders where client_ref = 'conc-ref-1'")" 1
check "stock tras una venta" "$(stock)" 4

pair "select micra_record_sale('$L', 'cash', null, null) is not null" "select micra_record_sale('$L', 'cash', null, null) is not null"
check "dos ventas a la vez no pierden stock" "$(stock)" 2

OID=$("${Q[@]}" -c "select id from orders where client_ref = 'conc-ref-1'")
pair "select micra_void_sale('$OID')->>'already_voided'" "select micra_void_sale('$OID')->>'already_voided'"
check "dos anulaciones a la vez: A anula" "$(grep -E '^(true|false)$' "$TMP/a")" false
check "dos anulaciones a la vez: B ya estaba" "$(grep -E '^(true|false)$' "$TMP/b")" true
check "devuelve una sola vez" "$(stock)" 3
check "suma de movimientos del pedido anulado" "$("${Q[@]}" -c "select sum(change_qty) from inventory_movements where reference_order_id = '$OID'")" 0
echo "Ventas atómicas de Micra: todo OK"
