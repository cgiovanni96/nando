#!/usr/bin/env bash
# nando-restore-test.sh — ripristina il dump più recente in un DB temporaneo e verifica.
# Uso: sudo /usr/local/sbin/nando-restore-test [--keep]
# Non tocca il database dell'applicazione.
#
# Prima di restaurare confronta lo sha256 del dump con quello del manifest scritto
# da nando-backup: un dump alterato o troncato non deve passare per buono.

set -euo pipefail
umask 077

RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_USER="${DB_USER:-nando}"
KEEP=0
if [[ "${1:-}" == "--keep" ]]; then KEEP=1; fi

if [[ -r "$RESTIC_ENV" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$RESTIC_ENV"
  set +a
fi

DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_USER="${DB_USER:-nando}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"

command -v docker >/dev/null 2>&1 || { echo "docker non trovato"; exit 1; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 1
fi

resolve_db_container() {
  if [[ -n "$DB_CONTAINER" ]]; then
    docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || {
      echo "container $DB_CONTAINER non trovato" >&2
      exit 1
    }
    printf '%s' "$DB_CONTAINER"
    return
  fi

  local rows matches count
  rows="$(docker ps --format '{{.ID}} {{.Label "com.docker.compose.project"}}' \
    --filter "label=com.docker.compose.service=$DB_SERVICE")"
  matches="$(printf '%s\n' "$rows" | awk -v project="$DB_PROJECT" '$2 == project { print $1 }')"
  if [[ -z "$matches" ]]; then
    matches="$(printf '%s\n' "$rows" | awk -v prefix="$DB_PROJECT-" 'index($2, prefix) == 1 { print $1 }')"
  fi
  count="$(printf '%s\n' "$matches" | grep -c . || true)"

  if [[ "$count" -ne 1 ]]; then
    echo "trovati $count container per service=$DB_SERVICE e project=$DB_PROJECT (esatto o prefisso)" >&2
    docker ps --format '  {{.Names}}	project={{.Label "com.docker.compose.project"}}	service={{.Label "com.docker.compose.service"}}' >&2
    echo "imposta DB_PROJECT (o DB_CONTAINER) in $RESTIC_ENV" >&2
    exit 1
  fi

  printf '%s' "$matches"
}

CONTAINER="$(resolve_db_container)"

LATEST_DUMP="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
[[ -n "$LATEST_DUMP" ]] || { echo "nessun dump in $BACKUP_DIR"; exit 1; }

MANIFEST="${LATEST_DUMP%.dump}.manifest.json"
if [[ -f "$MANIFEST" ]]; then
  SHA="$(sha256sum "$LATEST_DUMP" | cut -d' ' -f1)"
  if ! grep -q "\"sha256\": \"$SHA\"" "$MANIFEST"; then
    echo "manifest non coerente: sha256 di $(basename "$LATEST_DUMP") assente in $(basename "$MANIFEST")" >&2
    exit 1
  fi
  echo "manifest coerente: $MANIFEST"
else
  echo "attenzione: $MANIFEST assente, salto il confronto dello sha256" >&2
fi

TEST_DB="nando_restore_test_$(date -u +%Y%m%d%H%M%S)"

cleanup() {
  if [[ "$KEEP" -eq 0 ]]; then
    docker exec -i "$CONTAINER" \
      dropdb -U "$DB_USER" --if-exists "$TEST_DB" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "== dump: $LATEST_DUMP ($(du -h "$LATEST_DUMP" | cut -f1)) =="
echo "== container: $CONTAINER =="
echo "== database di test: $TEST_DB =="

docker exec -i "$CONTAINER" createdb -U "$DB_USER" "$TEST_DB"

docker exec -i "$CONTAINER" \
  pg_restore -U "$DB_USER" -d "$TEST_DB" \
  --no-owner --no-privileges --exit-on-error < "$LATEST_DUMP"

TABLES="$(docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$TEST_DB" -Atc \
  "select count(*) from information_schema.tables where table_schema='public';" | tr -d '[:space:]')"

[[ "${TABLES:-0}" -gt 0 ]] || { echo "restore fallito: nessuna tabella pubblica"; exit 1; }

docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$TEST_DB" -Atc "select 1;" >/dev/null

echo "restore ok: $TABLES tabelle pubbliche"
if [[ "$KEEP" -eq 1 ]]; then
  echo "database mantenuto: $TEST_DB (ricordati di eliminarlo)"
fi

if [[ -n "${HEALTHCHECKS_RESTORE_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_RESTORE_URL" >/dev/null && echo "healthchecks ping ok"
fi
