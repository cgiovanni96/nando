#!/usr/bin/env bash
# nando-backup.sh — dump Postgres + manifest dei conteggi + restic su R2 + retention.
# Uso: sudo /usr/local/sbin/nando-backup
# Richiede: /srv/nando/secrets/restic.env (600) con RESTIC_REPOSITORY,
# RESTIC_PASSWORD_FILE, credenziali S3, HEALTHCHECKS_BACKUP_URL opzionale e,
# se serve, DB_PROJECT/DB_CONTAINER/DB_NAME/DB_USER.
#
# Il database vive in Dokploy, non più in /srv/nando/compose: il container viene
# risolto per etichetta Compose, quindi il nome generato da Dokploy non conta.

set -euo pipefail
umask 077

RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"

command -v docker >/dev/null 2>&1 || { echo "docker non trovato"; exit 1; }
command -v restic >/dev/null 2>&1 || { echo "restic non trovato"; exit 1; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 1
fi
[[ -r "$RESTIC_ENV" ]] || { echo "manca $RESTIC_ENV"; exit 1; }

# set -a: restic legge repository e credenziali S3 dall'ambiente, non dal file.
set -a
# shellcheck disable=SC1090
source "$RESTIC_ENV"
set +a

DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_NAME="${DB_NAME:-nando_staging}"
DB_USER="${DB_USER:-nando}"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE mancante}"

# Il container del database si riconosce dalle etichette Compose: Dokploy genera
# nomi e suffissi diversi (`nando-staging-iilphp`), ma project e service restano
# stabili. Prima si cerca il progetto esatto, poi il prefisso `$DB_PROJECT-`.
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
    echo "candidati:" >&2
    docker ps --format '  {{.Names}}	project={{.Label "com.docker.compose.project"}}	service={{.Label "com.docker.compose.service"}}' >&2
    echo "imposta DB_PROJECT (o DB_CONTAINER) in $RESTIC_ENV" >&2
    exit 1
  fi

  printf '%s' "$matches"
}

CONTAINER="$(resolve_db_container)"

mkdir -p "$BACKUP_DIR"
exec 9>/var/lock/nando-backup.lock
flock -n 9 || { echo "backup già in corso"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/nando-$STAMP.dump"
COUNTS="$BACKUP_DIR/nando-$STAMP.counts.tsv"
MANIFEST="$BACKUP_DIR/nando-$STAMP.manifest.json"
OK=0

cleanup() {
  if [[ "$OK" -ne 1 ]]; then
    rm -f "$DUMP" "$COUNTS" "$MANIFEST"
  fi
}
trap cleanup EXIT

echo "== dump $DB_NAME da $CONTAINER =="
docker exec -i "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z9 > "$DUMP"

[[ -s "$DUMP" ]] || { echo "dump vuoto"; exit 1; }

echo "== verifica dump =="
docker exec -i "$CONTAINER" pg_restore --list < "$DUMP" >/dev/null
echo "dump ok: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "== conteggi per tabella =="
: > "$COUNTS"
while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  count="$(docker exec -i "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) from $table")"
  printf '%s\t%s\n' "$table" "$count" >> "$COUNTS"
done < <(docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -Atc \
  "select schemaname || '.' || relname from pg_stat_user_tables order by 1")

JOURNAL="$(docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -Atc \
  "select case when to_regclass('drizzle.__drizzle_migrations') is null then '' else (select count(*)::text from drizzle.__drizzle_migrations) end")"
if ! [[ "$JOURNAL" =~ ^[0-9]+$ ]]; then
  JOURNAL="null"
fi

SHA="$(sha256sum "$DUMP" | cut -d' ' -f1)"
BYTES="$(stat -c %s "$DUMP")"
DUMP_NAME="$(basename "$DUMP")"

{
  printf '{\n'
  printf '  "formatVersion": 1,\n'
  printf '  "createdAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "database": "%s",\n' "$DB_NAME"
  if [[ -n "${IMAGE_TAG:-}" ]]; then
    printf '  "imageTag": "%s",\n' "$IMAGE_TAG"
  else
    printf '  "imageTag": null,\n'
  fi
  printf '  "journalVersion": %s,\n' "$JOURNAL"
  printf '  "counts": {\n'
  awk -F'\t' 'BEGIN { first = 1 } { if (!first) printf ",\n"; printf "    \"%s\": %s", $1, $2; first = 0 } END { printf "\n" }' "$COUNTS"
  printf '  },\n'
  printf '  "parts": {\n'
  printf '    "%s": { "sha256": "%s", "bytes": %s }\n' "$DUMP_NAME" "$SHA" "$BYTES"
  printf '  }\n'
  printf '}\n'
} > "$MANIFEST"

echo "manifest: $MANIFEST"

echo "== restic backup =="
PATHS=("$BACKUP_DIR" /srv/nando/compose /srv/nando/secrets)
if [[ -d /etc/cloudflared ]]; then PATHS+=(/etc/cloudflared); fi
if [[ -d /etc/dokploy ]]; then PATHS+=(/etc/dokploy); fi
for f in /etc/systemd/system/nando-*.service /etc/systemd/system/nando-*.timer /etc/docker/daemon.json; do
  if [[ -f "$f" ]]; then PATHS+=("$f"); fi
done

restic backup \
  --tag nando \
  --host "$(hostname)" \
  --exclude /srv/nando/secrets/restic-password \
  "${PATHS[@]}"

echo "== retention =="
restic forget --keep-daily 30 --keep-weekly 12 --keep-monthly 12 --prune
restic check

echo "== pulizia dump locali > 7 giorni =="
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name '*.dump' -o -name '*.manifest.json' -o -name '*.counts.tsv' \) \
  -mtime +7 -print -delete

OK=1
echo "backup completato"

if [[ -n "${HEALTHCHECKS_BACKUP_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_BACKUP_URL" >/dev/null && echo "healthchecks ping ok"
fi
