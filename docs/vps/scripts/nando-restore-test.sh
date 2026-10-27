#!/usr/bin/env bash
# nando-restore-test.sh — ripristina il dump più recente in un DB temporaneo e verifica.
# Uso: sudo /usr/local/sbin/nando-restore-test [--keep]
# Non tocca il database di produzione.

set -euo pipefail
umask 077

COMPOSE_DIR="${COMPOSE_DIR:-/srv/nando/compose}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-nando}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
KEEP=0
if [[ "${1:-}" == "--keep" ]]; then KEEP=1; fi

export IMAGE_TAG="${IMAGE_TAG:-production}"

COMPOSE=(docker compose -f "$COMPOSE_FILE")

if [[ -r /srv/nando/secrets/restic.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . /srv/nando/secrets/restic.env
  set +a
fi

command -v docker >/dev/null 2>&1 || { echo "docker non trovato"; exit 1; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 1
fi

LATEST_DUMP="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
[[ -n "$LATEST_DUMP" ]] || { echo "nessun dump in $BACKUP_DIR"; exit 1; }

TEST_DB="nando_restore_test_$(date -u +%Y%m%d%H%M%S)"

cleanup() {
  if [[ "$KEEP" -eq 0 ]]; then
    "${COMPOSE[@]}" exec -T "$DB_SERVICE" \
      dropdb -U "$DB_USER" --if-exists "$TEST_DB" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "== dump: $LATEST_DUMP ($(du -h "$LATEST_DUMP" | cut -f1)) =="
echo "== database di test: $TEST_DB =="

"${COMPOSE[@]}" exec -T "$DB_SERVICE" createdb -U "$DB_USER" "$TEST_DB"

"${COMPOSE[@]}" exec -T "$DB_SERVICE" \
  pg_restore -U "$DB_USER" -d "$TEST_DB" \
  --no-owner --no-privileges --exit-on-error < "$LATEST_DUMP"

TABLES="$("${COMPOSE[@]}" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$TEST_DB" -Atc \
  "select count(*) from information_schema.tables where table_schema='public';" | tr -d '[:space:]')"

[[ "${TABLES:-0}" -gt 0 ]] || { echo "restore fallito: nessuna tabella pubblica"; exit 1; }

"${COMPOSE[@]}" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$TEST_DB" -Atc "select 1;" >/dev/null

echo "restore ok: $TABLES tabelle pubbliche"
if [[ "$KEEP" -eq 1 ]]; then
  echo "database mantenuto: $TEST_DB (ricordati di eliminarlo)"
fi

if [[ -n "${HEALTHCHECKS_RESTORE_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_RESTORE_URL" >/dev/null && echo "healthchecks ping ok"
fi
