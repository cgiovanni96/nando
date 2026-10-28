#!/usr/bin/env bash
# nando-backup.sh — dump Postgres + restic su R2 + retention.
# Uso: sudo /usr/local/sbin/nando-backup
# Richiede: /srv/nando/secrets/restic.env (600) con RESTIC_REPOSITORY,
# RESTIC_PASSWORD_FILE, credenziali S3 e HEALTHCHECKS_BACKUP_URL opzionale.

set -euo pipefail
umask 077

COMPOSE_DIR="${COMPOSE_DIR:-/srv/nando/compose}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${DB_NAME:-nando}"
DB_USER="${DB_USER:-nando}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"

export IMAGE_TAG="${IMAGE_TAG:-production}"

COMPOSE=(docker compose -f "$COMPOSE_FILE")

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
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE mancante}"

mkdir -p "$BACKUP_DIR"
exec 9>/var/lock/nando-backup.lock
flock -n 9 || { echo "backup già in corso"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/nando-$STAMP.dump"
OK=0

cleanup() {
  if [[ "$OK" -ne 1 && -f "$DUMP" ]]; then
    echo "backup fallito: rimuovo $DUMP" >&2
    rm -f "$DUMP"
  fi
}
trap cleanup EXIT

echo "== dump $DB_NAME =="
"${COMPOSE[@]}" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z9 > "$DUMP"

[[ -s "$DUMP" ]] || { echo "dump vuoto"; exit 1; }

echo "== verifica dump =="
"${COMPOSE[@]}" exec -T "$DB_SERVICE" pg_restore --list < "$DUMP" >/dev/null
echo "dump ok: $DUMP ($(du -h "$DUMP" | cut -f1))"

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
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -mtime +7 -print -delete

OK=1
echo "backup completato"

if [[ -n "${HEALTHCHECKS_BACKUP_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_BACKUP_URL" >/dev/null && echo "healthchecks ping ok"
fi
