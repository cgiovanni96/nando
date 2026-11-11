#!/usr/bin/env bash
# nando-assets-snapshot.sh — copia giornaliera degli allegati in un bucket di snapshot.
# Uso: sudo /usr/local/sbin/nando-assets-snapshot
#
# R2 non supporta il versioning S3 (`PutBucketVersioning` è assente): la copia
# fuori dal bucket vive in `nando-assets-snapshots/snapshots/<data>/`, con
# lifecycle di 90 giorni sul bucket. Un oggetto cancellato dal bucket live resta
# negli snapshot precedenti.

set -euo pipefail
umask 077

RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"

command -v aws >/dev/null 2>&1 || { echo "aws CLI non trovato (apt-get install awscli)"; exit 1; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 1
fi
[[ -r "$RESTIC_ENV" ]] || { echo "manca $RESTIC_ENV"; exit 1; }

set -a
# shellcheck disable=SC1090
source "$RESTIC_ENV"
set +a

ASSETS_BUCKET="${ASSETS_BUCKET:-nando-assets}"
ASSETS_SNAPSHOT_BUCKET="${ASSETS_SNAPSHOT_BUCKET:-nando-assets-snapshots}"
SNAPSHOT_PREFIX="${SNAPSHOT_PREFIX:-snapshots}"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"
R2_ENDPOINT="${R2_ENDPOINT:-$(printf '%s' "${RESTIC_REPOSITORY#s3:}" | sed 's#/[^/]*$##')}"
[[ -n "$R2_ENDPOINT" ]] || { echo "R2_ENDPOINT non derivabile da RESTIC_REPOSITORY"; exit 1; }

DATE="$(date -u +%Y-%m-%d)"
TARGET="s3://$ASSETS_SNAPSHOT_BUCKET/$SNAPSHOT_PREFIX/$DATE/"

echo "== snapshot $ASSETS_BUCKET -> $TARGET =="
aws --endpoint-url "$R2_ENDPOINT" s3 sync \
  "s3://$ASSETS_BUCKET/" "$TARGET" --only-show-errors

COUNT="$(aws --endpoint-url "$R2_ENDPOINT" s3 ls "$TARGET" --recursive | grep -c . || true)"
echo "snapshot completato: $COUNT oggetti in $TARGET"

if [[ -n "${HEALTHCHECKS_ASSETS_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_ASSETS_URL" >/dev/null && echo "healthchecks ping ok"
fi
