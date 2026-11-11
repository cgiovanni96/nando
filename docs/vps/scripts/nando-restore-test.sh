#!/usr/bin/env bash
# nando-restore-test.sh — ripristina il dump più recente in un DB temporaneo e verifica.
# Uso: sudo /usr/local/sbin/nando-restore-test [--keep] [--export]
# Non tocca il database dell'applicazione.
#
# --export verifica anche l'ultimo archivio su /srv/nando/exports: richiede
# AGE_IDENTITY_FILE con la chiave privata age fornita al momento del test.
# La chiave privata non deve restare sulla VPS.

set -euo pipefail
umask 077

RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
EXPORT_DIR="${EXPORT_DIR:-/srv/nando/exports}"
DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_USER="${DB_USER:-nando}"
AGE_IDENTITY_FILE="${AGE_IDENTITY_FILE:-}"
KEEP=0
CHECK_EXPORT=0

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    --export) CHECK_EXPORT=1 ;;
    *) echo "opzione sconosciuta: $arg" >&2; exit 2 ;;
  esac
done

if [[ -r "$RESTIC_ENV" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$RESTIC_ENV"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
EXPORT_DIR="${EXPORT_DIR:-/srv/nando/exports}"
DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_USER="${DB_USER:-nando}"
AGE_IDENTITY_FILE="${AGE_IDENTITY_FILE:-}"

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
EXPORT_WORK=""

cleanup() {
  if [[ "$KEEP" -eq 0 ]]; then
    docker exec -i "$CONTAINER" \
      dropdb -U "$DB_USER" --if-exists "$TEST_DB" >/dev/null 2>&1 || true
  fi
  if [[ -n "$EXPORT_WORK" && -d "$EXPORT_WORK" ]]; then
    rm -rf "$EXPORT_WORK"
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

verify_export() {
  local archive work test_db
  archive="$(ls -1t "$EXPORT_DIR"/nando-export-*.tar.age 2>/dev/null | head -1 || true)"

  if [[ -z "$archive" ]]; then
    echo "nessun archivio di export in $EXPORT_DIR" >&2
    exit 1
  fi
  if [[ ! -r "$AGE_IDENTITY_FILE" ]]; then
    echo "AGE_IDENTITY_FILE non impostata o non leggibile: serve la chiave privata age" >&2
    exit 1
  fi

  work="$(mktemp -d)"
  EXPORT_WORK="$work"
  echo "== export: $archive =="

  age -d -i "$AGE_IDENTITY_FILE" "$archive" | tar -xf - -C "$work"

  for part in database.dump schema.sql counts.tsv README.md; do
    [[ -f "$work/$part" ]] || { echo "export incompleto: manca $part" >&2; exit 1; }
    sha="$(sha256sum "$work/$part" | cut -d' ' -f1)"
    if ! grep -q "\"$part\": { \"sha256\": \"$sha\"" "$work/MANIFEST.json"; then
      echo "manifest non coerente per $part" >&2
      exit 1
    fi
  done
  echo "manifest coerente per dump, schema, counts e README"

  test_db="nando_export_test_$(date -u +%Y%m%d%H%M%S)"
  docker exec -i "$CONTAINER" createdb -U "$DB_USER" "$test_db"
  docker exec -i "$CONTAINER" \
    pg_restore -U "$DB_USER" -d "$test_db" \
    --no-owner --no-privileges --exit-on-error < "$work/database.dump"

  local failures=0
  while IFS=$'\t' read -r table expected; do
    [[ -z "$table" ]] && continue
    actual="$(docker exec -i "$CONTAINER" \
      psql -U "$DB_USER" -d "$test_db" -Atc "select count(*) from $table")"
    if [[ "$actual" != "$expected" ]]; then
      echo "conteggio diverso per $table: manifest $expected, restore $actual" >&2
      failures=1
    fi
  done < "$work/counts.tsv"

  docker exec -i "$CONTAINER" dropdb -U "$DB_USER" --if-exists "$test_db" >/dev/null 2>&1 || true

  [[ "$failures" -eq 0 ]] || { echo "verifica export fallita" >&2; exit 1; }
  echo "export verificato: conteggi coerenti con il manifest"
}

if [[ "$CHECK_EXPORT" -eq 1 ]]; then
  verify_export
elif [[ -n "$(ls -1 "$EXPORT_DIR"/nando-export-*.tar.age 2>/dev/null | head -1 || true)" ]]; then
  echo "attenzione: archivio di export presente ma non verificato (usa --export con AGE_IDENTITY_FILE)" >&2
fi

if [[ "$KEEP" -eq 1 ]]; then
  echo "database mantenuto: $TEST_DB (ricordati di eliminarlo)"
fi

if [[ -n "${HEALTHCHECKS_RESTORE_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_RESTORE_URL" >/dev/null && echo "healthchecks ping ok"
fi
