#!/usr/bin/env bash
# Waypoint · teste les migrations et la sécurité sur un PostgreSQL local jetable.
#
#   bash supabase/tests/run-local.sh
#
# Prérequis : PostgreSQL 15+ (serveur) installé. Aucune donnée n'est conservée :
# un cluster temporaire est créé puis supprimé. PostGIS n'est pas requis ;
# la migration 0700 est ignorée si l'extension est absente (elle s'applique sur Supabase).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "Serveur PostgreSQL introuvable (PGBIN=$PGBIN)"; exit 1; }

WORK="$(mktemp -d)"
PORT="${PGPORT:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown postgres:postgres "$WORK"
  RUN=(runuser -u postgres --)
fi
trap '"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -X -q -o /dev/null -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database waypoint_test" >/dev/null
PSQL+=(-d waypoint_test)

echo "== Shim Supabase"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if [[ "$name" == *postgis* ]] && ! "${PSQL[@]}" -tAc "select 1 from pg_available_extensions where name='postgis'" | grep -q 1; then
    echo "== $name : ignorée (PostGIS absent de ce PostgreSQL)"
    continue
  fi
  echo "== $name"
  "${PSQL[@]}" -f "$f"
done

echo "== Regroupement des migrations à jour ?"
node "$ROOT/scripts/bundle-sql.mjs" --check

echo "== Tests"
cd "$ROOT"
"${PSQL[@]}" -f supabase/tests/rls.test.sql 2>&1 | sed -e 's/^psql:[^ ]* [0-9]*: //'
