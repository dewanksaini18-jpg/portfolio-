#!/usr/bin/env bash
# Runs supabase/schema.sql against a throw-away local Postgres (needs postgres binaries; run as root or any user).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
DIR="${1:-/tmp/pgtest}"; PORT=54329
id postgres >/dev/null 2>&1 || useradd -m postgres
rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres "$DIR"
su postgres -c "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"
su postgres -c "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
PSQL="psql -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
cp "$HERE"/*.sql "$DIR/"; chmod a+r "$DIR"/*.sql
su postgres -c "$PSQL -f $DIR/schema-stubs.sql"
echo "-- first run";  su postgres -c "$PSQL -f $HERE/../supabase/schema.sql" 2>&1 | grep -v '^NOTICE' || true
echo "-- second run (idempotency)"; su postgres -c "$PSQL -f $HERE/../supabase/schema.sql" 2>&1 | grep -v '^NOTICE' || true
su postgres -c "psql -h $DIR -p $PORT -U postgres -d postgres -f $DIR/schema-assertions.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" 
