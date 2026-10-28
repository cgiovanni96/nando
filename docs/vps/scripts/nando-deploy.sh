#!/usr/bin/env bash
# nando-deploy.sh — pull + migrazioni + up + smoke, con rollback sul tag precedente.
# Uso: nando-deploy <staging|production> <tag>     esegue un deploy
#      nando-deploy status <staging|production>   stato, senza modificare nulla
#
# Installato in /usr/local/sbin/nando-deploy. Gira come root tramite sudo
# ristretto all'utente nando-deploy (NOPASSWD, solo questo comando).
# L'immagine si seleziona con IMAGE_TAG nell'ambiente: nessuna scrittura su .env.

set -euo pipefail
umask 027

COMPOSE_DIR="${COMPOSE_DIR:-/srv/nando/compose}"
LOG_FILE="${LOG_FILE:-/var/log/nando/deploy.log}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"

action="deploy"
env_name=""
tag=""

usage() {
  cat >&2 <<'EOF'
uso:
  nando-deploy <staging|production> <tag>     esegue un deploy
  nando-deploy status <staging|production>    mostra stato e health, senza modifiche

tag: forma sha-<7..40 hex>, es. sha-a1b2c3d
EOF
  exit 2
}

log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$env_name" "$*" | tee -a "$LOG_FILE" >&2; }
die() { log "ERRORE: $*"; exit 1; }

case "${1:-}" in
  ""|-h|--help) usage ;;
  status) action="status"; env_name="${2:-}" ;;
  *)      env_name="${1:-}"; tag="${2:-}" ;;
esac

case "$env_name" in
  staging)
    COMPOSE=(docker compose -p nando-staging -f docker-compose.yml -f docker-compose.staging.yml)
    HEALTH_URL="http://127.0.0.1:3002/api/health"
    ;;
  production)
    COMPOSE=(docker compose -p nando -f docker-compose.yml)
    HEALTH_URL="http://127.0.0.1:3001/api/health"
    ;;
  *)
    usage
    ;;
esac

cd "$COMPOSE_DIR" || die "directory compose non trovata: $COMPOSE_DIR"

health_check() {
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 3
  done
  return 1
}

current_tag() {
  local cid
  cid="$("${COMPOSE[@]}" ps -q app 2>/dev/null | head -1)" || true
  [ -n "$cid" ] || return 0
  docker inspect -f '{{.Config.Image}}' "$cid" 2>/dev/null | sed 's/.*://'
}

if [ "$action" = "status" ]; then
  echo "ambiente: $env_name"
  echo "tag in esecuzione: $(current_tag || true)"
  "${COMPOSE[@]}" ps || true
  if health_check; then echo "health: OK ($HEALTH_URL)"; else echo "health: FAIL ($HEALTH_URL)"; exit 1; fi
  exit 0
fi

[ "$action" = "deploy" ] || usage
[ -n "$tag" ] || usage

[[ "$tag" =~ ^sha-[0-9a-f]{7,40}$ ]] || die "tag non valido: '$tag' (atteso sha-<hex>)"

[ -f docker-compose.yml ] || die "manca docker-compose.yml in $COMPOSE_DIR"
if [ "$env_name" = "staging" ] && [ ! -f docker-compose.staging.yml ]; then
  die "manca docker-compose.staging.yml: staging non è ancora configurato"
fi

prev="$(current_tag || true)"
log "deploy richiesto: $tag (in esecuzione: ${prev:-nessuno})"

if [ "$env_name" = "production" ]; then
  log "backup pre-deploy"
  /usr/local/sbin/nando-backup >>"$LOG_FILE" 2>&1 || die "backup fallito: deploy annullato prima di toccare l'app"
fi

log "pull immagine"
IMAGE_TAG="$tag" "${COMPOSE[@]}" pull app || die "pull fallito: tag inesistente o registry non raggiungibile"

log "migrazioni"
# Un container one-shot: se la migrazione fallisce l'app corrente resta in piedi.
IMAGE_TAG="$tag" "${COMPOSE[@]}" run --rm app pnpm db:migrate \
  || die "migrazioni fallite: app non aggiornata (il dump pre-deploy è in /srv/nando/backups/db)"

log "avvio app"
IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d app || die "up fallito"

if health_check; then
  log "smoke OK, deploy completato su $env_name con $tag"
  exit 0
fi

log "smoke FALLITO su $HEALTH_URL"
if [ -n "$prev" ]; then
  log "rollback a $prev"
  IMAGE_TAG="$prev" "${COMPOSE[@]}" up -d app || log "rollback: up fallito"
  if health_check; then log "rollback completato, servizio ripristinato su $prev"; else log "rollback eseguito ma health ancora FAIL"; fi
else
  log "nessun tag precedente da cui tornare: intervento manuale richiesto"
fi
die "deploy annullato"
