#!/usr/bin/env bash
# nando-health.sh — report read-only dello stato della VPS Nando.
# Uso: sudo /usr/local/sbin/nando-health [--full]
# Exit: 0 = OK, 1 = WARN, 2 = FAIL

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/srv/nando/compose}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${DB_NAME:-nando}"
DB_USER="${DB_USER:-nando}"
APP_URL="${APP_URL:-http://127.0.0.1:3001/api/health}"
STAGING_URL="${STAGING_URL:-http://127.0.0.1:3002/api/health}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nando/backups/db}"
FULL=0
if [[ "${1:-}" == "--full" ]]; then FULL=1; fi

export IMAGE_TAG="${IMAGE_TAG:-production}"

WARN=0
FAIL=0

ok()   { printf '[OK]   %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; WARN=$((WARN + 1)); }
fail() { printf '[FAIL] %s\n' "$*"; FAIL=$((FAIL + 1)); }

section() { printf '\n## %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { echo "docker non trovato"; exit 2; }
command -v curl   >/dev/null 2>&1 || { echo "curl non trovato"; exit 2; }
if [[ "$(id -u)" -ne 0 ]]; then
  echo "eseguire con sudo" >&2
  exit 2
fi

section "Host"
printf 'date:     %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'hostname: %s\n' "$(hostname)"
printf 'uptime:   %s\n' "$(uptime -p 2>/dev/null || uptime)"
printf 'load:     %s\n' "$(cut -d' ' -f1-3 /proc/loadavg)"

section "Disco e memoria"
DISK_PCT="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if   [[ "$DISK_PCT" -ge 85 ]]; then fail "disco / ${DISK_PCT}%"
elif [[ "$DISK_PCT" -ge 75 ]]; then warn "disco / ${DISK_PCT}%"
else ok "disco / ${DISK_PCT}%"; fi

MEM_AVAIL="$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo)"
if   [[ "$MEM_AVAIL" -lt 512 ]]; then fail "RAM disponibile ${MEM_AVAIL} MB"
elif [[ "$MEM_AVAIL" -lt 1024 ]]; then warn "RAM disponibile ${MEM_AVAIL} MB"
else ok "RAM disponibile ${MEM_AVAIL} MB"; fi

section "Systemd"
FAILED_UNITS="$(systemctl --failed --no-legend --plain 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$FAILED_UNITS" -gt 0 ]]; then
  fail "unità systemd failed: ${FAILED_UNITS}"
  systemctl --failed --no-legend --plain 2>/dev/null | head -10
else
  ok "nessuna unità failed"
fi

section "Container"
if systemctl is-active --quiet docker; then
  ok "docker attivo"
else
  fail "docker non attivo"
fi

if [[ -f "$COMPOSE_FILE" ]]; then
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
  if "${COMPOSE[@]}" ps >/dev/null 2>&1; then
    RUNNING="$("${COMPOSE[@]}" ps --status running --services 2>/dev/null | wc -l | tr -d ' ')"
    ok "compose: ${RUNNING} servizi running"
    BAD="$("${COMPOSE[@]}" ps --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -Ei 'unhealthy|restarting|exited' || true)"
    if [[ -n "$BAD" ]]; then fail "container non sani:"; echo "$BAD"; fi
  else
    warn "compose non raggiungibile in $COMPOSE_FILE"
  fi
else
  fail "compose file mancante: $COMPOSE_FILE"
fi

section "App"
if curl -fsS -m 5 "$APP_URL" >/dev/null 2>&1; then
  ok "produzione $APP_URL"
else
  fail "produzione $APP_URL non risponde"
fi
if curl -fsS -m 5 "$STAGING_URL" >/dev/null 2>&1; then
  ok "staging $STAGING_URL"
else
  warn "staging $STAGING_URL non risponde"
fi

section "Postgres"
if [[ -f "$COMPOSE_FILE" ]]; then
  if docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
      pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    ok "pg_isready"
  else
    fail "pg_isready"
  fi
fi

section "Backup"
LATEST_DUMP="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
if [[ -z "$LATEST_DUMP" ]]; then
  fail "nessun dump in $BACKUP_DIR"
else
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LATEST_DUMP") ) / 3600 ))
  if   [[ "$AGE_H" -gt 48 ]]; then fail "ultimo dump ${AGE_H}h fa: $LATEST_DUMP"
  elif [[ "$AGE_H" -gt 26 ]]; then warn "ultimo dump ${AGE_H}h fa: $LATEST_DUMP"
  else ok "ultimo dump ${AGE_H}h fa"; fi
fi

section "Ingresso"
if systemctl is-active --quiet cloudflared; then
  ok "cloudflared attivo"
else
  warn "cloudflared non attivo"
fi
if systemctl is-active --quiet tailscaled; then
  ok "tailscaled attivo"
else
  warn "tailscaled non attivo"
fi

section "Porte in ascolto"
PORTS="$(ss -tlnH 2>/dev/null | awk '{print $4}' | sort -u)"
echo "$PORTS"
if echo "$PORTS" | grep -Eq '^(\*|0\.0\.0\.0|\[::\]):(3000|3001|3002|5432)$'; then
  fail "porta applicativa esposta su tutte le interfacce"
else
  ok "nessuna porta app su 0.0.0.0"
fi

section "Aggiornamenti"
UPGRADABLE="$(apt list --upgradable 2>/dev/null | grep -c '^[^ ]*/' || true)"
UPGRADABLE="${UPGRADABLE:-0}"
if [[ "$UPGRADABLE" -gt 0 ]]; then warn "${UPGRADABLE} pacchetti aggiornabili"; else ok "nessun aggiornamento"; fi

if [[ "$FULL" -eq 1 ]]; then
  section "Errori recenti"
  ERRS="$(journalctl -p err --since '7 days ago' --no-pager 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$ERRS" -gt 20 ]]; then warn "${ERRS} righe di errore negli ultimi 7 giorni"; else ok "${ERRS} righe di errore"; fi
  journalctl -p err --since '7 days ago' --no-pager 2>/dev/null | tail -15 || true

  section "Docker disk"
  docker system df || true
fi

section "Sommario"
printf 'warn=%d fail=%d\n' "$WARN" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then exit 2; fi
if [[ "$WARN" -gt 0 ]]; then exit 1; fi
exit 0
