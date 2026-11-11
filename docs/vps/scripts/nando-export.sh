#!/usr/bin/env bash
# nando-export.sh — archivio di export cifrato con age e caricato su R2.
# Uso: sudo /usr/local/sbin/nando-export
#
# Formato (ADR-0011): database.dump, schema.sql derivato dal dump, counts.tsv,
# MANIFEST.json con sha256 di ogni parte, README.md. Il tutto in un tar cifrato
# verso la chiave pubblica age; la privata sta nel password manager.
#
# Il dump è l'ultimo backup: un export non deve mai leggere il database mentre
# un deploy è in corso.

set -euo pipefail
umask 077

RESTIC_ENV="${RESTIC_ENV:-/srv/nando/secrets/restic.env}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
EXPORT_DIR="${EXPORT_DIR:-/srv/nando/exports}"

command -v docker >/dev/null 2>&1 || { echo "docker non trovato"; exit 1; }
command -v age >/dev/null 2>&1 || { echo "age non trovato (apt-get install age)"; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar non trovato"; exit 1; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 1
fi
[[ -r "$RESTIC_ENV" ]] || { echo "manca $RESTIC_ENV"; exit 1; }

set -a
# shellcheck disable=SC1090
source "$RESTIC_ENV"
set +a

BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
EXPORT_DIR="${EXPORT_DIR:-/srv/nando/exports}"
EXPORTS_BUCKET="${EXPORTS_BUCKET:-nando-exports}"
AGE_RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-/srv/nando/secrets/age-public.key}"
DB_PROJECT="${DB_PROJECT:-nando-staging}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_NAME="${DB_NAME:-nando_staging}"
DB_USER="${DB_USER:-nando}"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"

R2_ENDPOINT="${R2_ENDPOINT:-$(printf '%s' "${RESTIC_REPOSITORY#s3:}" | sed 's#/[^/]*$##')}"
[[ -n "$R2_ENDPOINT" ]] || { echo "R2_ENDPOINT non derivabile da RESTIC_REPOSITORY"; exit 1; }

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
    exit 1
  fi

  printf '%s' "$matches"
}

conflict="$(ls -1t "$BACKUP_DIR"/*.manifest.json 2>/dev/null | head -1 || true)"
[[ -n "$conflict" ]] || { echo "nessun manifest in $BACKUP_DIR: esegui prima nando-backup"; exit 1; }
MANIFEST="$conflict"
DUMP="${MANIFEST%.manifest.json}.dump"
COUNTS="${MANIFEST%.manifest.json}.counts.tsv"
[[ -s "$DUMP" ]] || { echo "dump assente per $MANIFEST"; exit 1; }

SHA="$(sha256sum "$DUMP" | cut -d' ' -f1)"
grep -q "\"sha256\": \"$SHA\"" "$MANIFEST" || {
  echo "manifest non coerente con $(basename "$DUMP")" >&2
  exit 1
}

RECIPIENT="$(grep -o 'age1[0-9a-z]*' "$AGE_RECIPIENT_FILE" 2>/dev/null | head -1 || true)"
if [[ -z "$RECIPIENT" ]]; then
  echo "chiave pubblica age non trovata in $AGE_RECIPIENT_FILE" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="nando-export-$STAMP"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$DUMP" "$WORK/database.dump"

if [[ -f "$COUNTS" ]]; then
  cp "$COUNTS" "$WORK/counts.tsv"
else
  echo "counts.tsv assente accanto al dump: li ricalcolo dal database" >&2
  CONTAINER="$(resolve_db_container)"
  : > "$WORK/counts.tsv"
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    count="$(docker exec -i "$CONTAINER" \
      psql -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) from $table")"
    printf '%s\t%s\n' "$table" "$count" >> "$WORK/counts.tsv"
  done < <(docker exec -i "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -Atc \
    "select schemaname || '.' || relname from pg_stat_user_tables order by 1")
fi

echo "== schema.sql derivato dal dump =="
docker exec -i "$(resolve_db_container)" \
  pg_restore -f - --schema-only --no-owner --no-privileges < "$WORK/database.dump" > "$WORK/schema.sql"
[[ -s "$WORK/schema.sql" ]] || { echo "schema.sql vuoto"; exit 1; }

IMAGE_TAG_VALUE="$(grep -m1 '"imageTag"' "$MANIFEST" | sed 's/.*"imageTag": //; s/,$//')"
JOURNAL_VALUE="$(grep -m1 '"journalVersion"' "$MANIFEST" | sed 's/.*"journalVersion": //; s/,$//')"
[[ -n "$IMAGE_TAG_VALUE" ]] || IMAGE_TAG_VALUE="null"
[[ -n "$JOURNAL_VALUE" ]] || JOURNAL_VALUE="null"

counts_json="$(awk -F'\t' 'BEGIN { first = 1 } { if (!first) printf ",\n"; printf "    \"%s\": %s", $1, $2; first = 0 } END { printf "\n" }' "$WORK/counts.tsv")"

part_line() {
  local file="$1"
  printf '    "%s": { "sha256": "%s", "bytes": %s }' \
    "$(basename "$file")" \
    "$(sha256sum "$file" | cut -d' ' -f1)" \
    "$(stat -c %s "$file")"
}

cat > "$WORK/README.md" <<'README'
# Export Nando

Archivio leggibile e cifrato prodotto da `nando-export` (ADR-0011).

- `database.dump` — `pg_dump -Fc` dell'ultimo backup.
- `schema.sql` — DDL derivato dal dump, non dal database.
- `counts.tsv` — conteggi per tabella al momento del dump.
- `MANIFEST.json` — data, database, tag immagine, versione del journal Drizzle, conteggi, `sha256` di ogni parte.

## Ripristino

```bash
age -d -i <chiave-privata> nando-export-<stamp>.tar.age | tar -xf - -C /tmp/nando-export
pg_restore -d <database-vuoto> --no-owner --no-privileges /tmp/nando-export/database.dump
```

Confronta i conteggi con `MANIFEST.json` prima di dichiarare il ripristino riuscito.
La chiave privata `age` non è sulla VPS: senza di essa l'archivio non è leggibile.

Gli allegati non sono inclusi finché Knowledge (M4a) non introduce il primo upload:
`MANIFEST.json` ha `attachments: []` e i file restano negli snapshot del bucket.
README

{
  printf '{\n'
  printf '  "formatVersion": 1,\n'
  printf '  "createdAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "database": "%s",\n' "$DB_NAME"
  printf '  "imageTag": %s,\n' "$IMAGE_TAG_VALUE"
  printf '  "journalVersion": %s,\n' "$JOURNAL_VALUE"
  printf '  "attachments": [],\n'
  printf '  "counts": {\n%s\n  },\n' "$counts_json"
  printf '  "parts": {\n'
  part_line "$WORK/database.dump"
  printf ',\n'
  part_line "$WORK/schema.sql"
  printf ',\n'
  part_line "$WORK/counts.tsv"
  printf ',\n'
  part_line "$WORK/README.md"
  printf '\n  }\n'
  printf '}\n'
} > "$WORK/MANIFEST.json"

mkdir -p "$EXPORT_DIR"
ARCHIVE="$EXPORT_DIR/$NAME.tar.age"

echo "== cifratura con age =="
tar -C "$WORK" -cf - . | age -r "$RECIPIENT" -o "$ARCHIVE"
[[ -s "$ARCHIVE" ]] || { echo "archivio vuoto"; exit 1; }
echo "archivio: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

echo "== retention locale: ultimi 12 archivi =="
ls -1t "$EXPORT_DIR"/nando-export-*.tar.age 2>/dev/null | tail -n +13 | xargs -r rm -f

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI non trovato: archivio creato ma non caricato su R2 (apt-get install awscli)" >&2
  exit 1
fi

echo "== upload su s3://$EXPORTS_BUCKET =="
aws --endpoint-url "$R2_ENDPOINT" s3 cp "$ARCHIVE" "s3://$EXPORTS_BUCKET/$(basename "$ARCHIVE")"
echo "export completato: $(basename "$ARCHIVE")"

if [[ -n "${HEALTHCHECKS_EXPORT_URL:-}" ]]; then
  curl -fsS -m 10 "$HEALTHCHECKS_EXPORT_URL" >/dev/null && echo "healthchecks ping ok"
fi
