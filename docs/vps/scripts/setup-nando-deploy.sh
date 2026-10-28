#!/usr/bin/env bash
# setup-nando-deploy.sh — crea l'utente di deploy CI e installa il wrapper.
# Da eseguire una volta come root:  sudo bash setup-nando-deploy.sh
# Idempotente: si può rieseguire senza effetti collaterali.
#
# Prerequisiti nella stessa directory: nando-deploy.sh, docker-compose.yml e la
# chiave pubblica della chiave usata da GitHub Actions (deploy_key.pub).

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_SRC="$SRC_DIR/nando-deploy.sh"
COMPOSE_SRC="$SRC_DIR/docker-compose.yml"
PUBKEY_FILE="$SRC_DIR/deploy_key.pub"

[ "$(id -u)" -eq 0 ] || { echo "eseguire con sudo" >&2; exit 1; }
for f in "$WRAPPER_SRC" "$COMPOSE_SRC" "$PUBKEY_FILE"; do
  [ -f "$f" ] || { echo "manca $f" >&2; exit 1; }
done

echo "== utente nando-deploy =="
if id nando-deploy >/dev/null 2>&1; then
  echo "utente già presente"
else
  adduser --disabled-password --gecos "" nando-deploy
fi

echo "== chiave di deploy =="
install -d -m 700 -o nando-deploy -g nando-deploy /home/nando-deploy/.ssh
# from= limita al range Tailscale: il runner entra solo dal tailnet.
{
  printf 'from="100.64.0.0/10",no-agent-forwarding,no-port-forwarding,no-X11-forwarding '
  tr -d '\r\n' < "$PUBKEY_FILE"
  printf '\n'
} > /home/nando-deploy/.ssh/authorized_keys
chown nando-deploy:nando-deploy /home/nando-deploy/.ssh/authorized_keys
chmod 600 /home/nando-deploy/.ssh/authorized_keys

echo "== wrapper =="
install -m 750 -o root -g root "$WRAPPER_SRC" /usr/local/sbin/nando-deploy
install -d -m 750 -o nando -g nando /var/log/nando
touch /var/log/nando/deploy.log
chown nando:nando /var/log/nando/deploy.log
chmod 640 /var/log/nando/deploy.log

echo "== sudoers: solo il wrapper =="
cat > /etc/sudoers.d/nando-deploy <<'EOF'
# Il runner CI può eseguire solo il wrapper di deploy, non docker arbitrario.
nando-deploy ALL=(root) NOPASSWD: /usr/local/sbin/nando-deploy
EOF
chmod 440 /etc/sudoers.d/nando-deploy

echo "== compose: nome progetto =="
# Il progetto attuale può chiamarsi "compose" (deriva dalla directory). Il compose
# aggiornato fissa `name: nando`; avviarlo così com'è creerebbe un SECONDO
# container db sullo stesso volume, cioè due Postgres sugli stessi file.
# Il riallineamento va fatto con backup PRIMA e con un down esplicito.
cd /srv/nando/compose

old_project="$(docker ps -a --filter 'label=com.docker.compose.service=db' \
  --format '{{.Label "com.docker.compose.project"}}' | sort -u | head -1 || true)"

echo "progetto che possiede il db: ${old_project:-nessuno}"

if [ -n "$old_project" ] && [ "$old_project" != "nando" ]; then
  echo "-- backup prima della riconfigurazione (progetto $old_project) --"
  # COMPOSE_PROJECT_NAME ha precedenza sul top-level `name:` del file, quindi il
  # backup funziona anche se il compose è già stato sostituito.
  if COMPOSE_PROJECT_NAME="$old_project" /usr/local/sbin/nando-backup >/tmp/nando-backup.out 2>&1; then
    echo "backup ok ($(ls -1t /srv/nando/backups/db/*.dump 2>/dev/null | head -1 | xargs -r du -h | cut -f1))"
  else
    echo "backup FALLITO: deploy annullato, non tocco i container" >&2
    tail -20 /tmp/nando-backup.out >&2
    exit 1
  fi

  install -m 640 -o nando -g nando "$SRC_DIR/docker-compose.yml" /srv/nando/compose/docker-compose.yml

  echo "-- fermo il vecchio progetto '$old_project' --"
  docker compose -p "$old_project" down
  echo "-- avvio nel progetto 'nando' (volume nando_pgdata invariato) --"
  docker compose up -d
else
  install -m 640 -o nando -g nando "$SRC_DIR/docker-compose.yml" /srv/nando/compose/docker-compose.yml
  docker compose up -d
fi

sleep 12
echo "-- stato --"
docker compose ps
docker compose exec -T db pg_isready -U nando -d nando
echo "-- un solo container db? --"
docker ps -a --filter 'label=com.docker.compose.service=db' \
  --format '{{.Names}} -> progetto {{.Label "com.docker.compose.project"}}'

echo "== validazione =="
visudo -c
bash -n /usr/local/sbin/nando-deploy && echo "wrapper: sintassi ok"
passwd -S nando-deploy

echo "== test permessi (deve funzionare solo status) =="
sudo -u nando-deploy sudo -n /usr/local/sbin/nando-deploy status production || true
echo "--- comando non permesso (deve fallire) ---"
sudo -u nando-deploy sudo -n docker ps >/dev/null 2>&1 \
  && echo "ERRORE: docker concesso" || echo "atteso: permesso negato"
