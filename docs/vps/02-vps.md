# 02 — Bootstrap della VPS

**Obiettivo:** Ubuntu aggiornato, utente amministrativo, SSH key-only via Tailscale, firewall chiuso, Docker, cloudflared. La VPS non deve avere porte applicative pubbliche.

> **Ordine corretto (verificato il 2026-10-27).** Tailscale va installato e **testato** *prima* di attivare UFW: la regola `allow in on tailscale0` non ha effetto finché l'interfaccia non esiste, e attivare UFW prima significa chiudersi fuori. Lo stesso vale per l'hardening SSH: si applica dopo aver verificato che il login con chiave funzioni per tutti gli utenti.

## Accesso iniziale

SSDNodes fornisce console web e accesso root iniziale. Usa la console per il primo accesso; non configurare password SSH permanenti.

```bash
# come root, una volta sola
adduser nando
usermod -aG sudo nando
install -d -m 700 -o nando -g nando /home/nando/.ssh
# incolla la chiave pubblica dell'operatore
nano /home/nando/.ssh/authorized_keys
chown nando:nando /home/nando/.ssh/authorized_keys
chmod 600 /home/nando/.ssh/authorized_keys
```

> **Non usare `adduser --disabled-password` per l'utente umano.** Senza password `sudo` chiede un'autenticazione interattiva che non esiste e ogni comando privilegiato fallisce. Le due opzioni praticabili sono: impostare una password con `passwd nando` (usata solo per `sudo`, il login SSH resta key-only) oppure concedere un `NOPASSWD` temporaneo durante il setup e rimuoverlo alla fine.

Testa prima di chiudere la sessione root:

```bash
ssh nando@89.233.107.32
sudo -v
```

## Hardening SSH

Il file **deve** chiamarsi `00-nando.conf`, non `99-nando.conf`: OpenSSH applica la **prima** occorrenza di ogni direttiva, e su Ubuntu `Include /etc/ssh/sshd_config.d/*.conf` è in cima al file principale. Cloud-init scrive `PasswordAuthentication yes` in `50-cloud-init.conf`; un drop-in chiamato `99-` verrebbe letto *dopo* e la sua impostazione sarebbe ignorata senza alcun errore apparente.

Crea `/etc/ssh/sshd_config.d/00-nando.conf`:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers nando nando-agent nando-deploy
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
```

Valida e ricarica:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

Tieni aperta la sessione corrente finché non hai verificato un nuovo login con chiave.

## Firewall

**Prerequisito:** Tailscale installato, `tailscale up` completato e `ssh nando@nando-vps` funzionante da un secondo terminale. Se attivi UFW prima, `tailscale0` non esiste, la regola SSH non si applica e perdi l'accesso.

Con Tailscale (consigliato):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0 to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Senza Tailscale, sostituisci la regola SSH con il tuo IP statico:

```bash
sudo ufw allow from <ADMIN_IP> to any port 22 proto tcp
```

**Non aprire 80/443**: l'ingresso è Cloudflare Tunnel. Se in futuro usi Traefik diretto, apri solo allora.

> Tieni aperta la sessione SSH prima di `ufw enable`. Se Tailscale non è ancora installato, la regola su `tailscale0` resta inattiva finché l'interfaccia non esiste: installa Tailscale (sotto) e verifica `ufw status verbose`.

> Docker pubblica le porte bypassando UFW. Ogni porta in `docker-compose.yml` deve essere bindata a `127.0.0.1` (es. `127.0.0.1:3001:3001`). Verifica con `ss -tlnp`.

## Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh -o /tmp/tailscale.sh
less /tmp/tailscale.sh
sudo sh /tmp/tailscale.sh
sudo tailscale up --hostname=nando-vps --ssh=false
sudo tailscale status
```

In alternativa, dal repository ufficiale (verificato su Ubuntu 26.04):

```bash
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(. /etc/os-release && echo $VERSION_CODENAME).noarmor.gpg \
  | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(. /etc/os-release && echo $VERSION_CODENAME).tailscale-keyring.list \
  | sudo tee /etc/apt/sources.list.d/tailscale.list >/dev/null
sudo apt-get update && sudo apt-get install -y tailscale
```

- `--ssh=false`: usiamo SSH standard con chiavi sopra Tailscale, più prevedibile per un agente LLM. Tailscale SSH è un'alternativa.
- Assegna un tag ACL `tag:nando-vps` e limita l'accesso al gruppo `group:admins` / `tag:agent`.
- Il nome MagicDNS sarà `nando-vps`; da qui in poi `ssh nando@nando-vps`.

Se Tailscale non è disponibile, usa Cloudflare Access SSH (vedi `06-llm-access.md`) o l'allowlist IP.

## Pacchetti base

```bash
sudo apt update
sudo apt install -y \
  curl ca-certificates gnupg jq git ufw fail2ban \
  unattended-upgrades needrestart restic rclone \
  htop btop ncdu less nano
```

`rclone` è opzionale se usi solo restic; `btop`/`ncdu` sono diagnostica.

## Aggiornamenti automatici

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Verifica `/etc/apt/apt.conf.d/20auto-upgrades`:

```text
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

In `/etc/apt/apt.conf.d/50unattended-upgrades` lascia `Automatic-Reboot "false"` e gestisci i reboot nella manutenzione mensile. `needrestart` segnala i servizi da riavviare.

### fail2ban su Ubuntu 24.04

Ubuntu 24.04 non ha necessariamente `/var/log/auth.log`: usa il backend systemd. Crea `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled = true
backend = systemd
```

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## Docker

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Il repository Docker pubblica `resolute` (Ubuntu 26.04): se in futuro un codename mancasse, `apt update` fallisce con `404` e va pinnato l'ultimo codename disponibile.

Non aggiungere `nando` al gruppo `docker`: è equivalente a root. Usa `sudo docker`/`sudo docker compose`.

Log rotation in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
```

```bash
sudo systemctl restart docker
```

## Dokploy (opzionale)

Dokploy è comodo per la UI e i deploy, ma **Compose resta la sorgente di verità**.

> **Non usare `dokploy.com/install.sh` su questa VPS.** Lo script ufficiale inizializza Docker **Swarm**, pubblica Traefik su `0.0.0.0:80/443` e la dashboard su `0.0.0.0:3000`. In Swarm non è possibile bindare una porta pubblicata a `127.0.0.1`, e UFW **non** filtra le porte pubblicate da Docker: si finirebbe con tre porte esposte a Internet.
>
> L'installazione usata qui è in Compose, senza Swarm e senza Traefik: vedi `03-stack.md`, sezione Dokploy. File nel repository: `deploy/dokploy/docker-compose.yml`.

Se in futuro vuoi Traefik per altri servizi, bindalo esplicitamente a `127.0.0.1` e verifica con `ss -tlnp`: 3000 e 80/443 non devono ascoltare su `0.0.0.0`.

Backuppa `/etc/dokploy` e il database di Dokploy insieme al resto (`nando-backup` li include già).

## cloudflared

Il repository Cloudflare **non pubblica il codename di Ubuntu 26.04** (`resolute`): va usato `noble` (24.04). `cloudflared` è un binario Go statico, quindi non dipende dalle librerie della distro e i futuri aggiornamenti continuano ad arrivare.

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
https://pkg.cloudflare.com/cloudflared noble main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update
sudo apt install -y cloudflared
```

Verifica la disponibilità del codename prima di cambiarlo:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://pkg.cloudflare.com/cloudflared/dists/$(. /etc/os-release && echo $VERSION_CODENAME)/Release
```

Poi, con il token del tunnel (vedi `01-domain.md`):

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

Il token è un segreto: non incollarlo in chat, non metterlo nel repository.

## Directory e permessi

```bash
sudo mkdir -p /srv/nando/{compose,backups/db,secrets,restore}
sudo chown -R nando:nando /srv/nando
sudo chmod 750 /srv/nando
sudo chmod 700 /srv/nando/secrets /srv/nando/restore
sudo install -d -m 750 -o nando -g nando /var/log/nando
```

Layout:

```text
/srv/nando/
  compose/            docker-compose.yml, override staging
  backups/db/         dump Postgres locali (7 giorni)
  secrets/            .env, restic.env, chiavi (600)
  restore/            restore test temporanei
/usr/local/sbin/      nando-health, nando-backup, nando-restore-test
/var/log/nando/       log applicativi e manutenzione
```

Permessi:

```bash
sudo chmod 600 /srv/nando/secrets/* /srv/nando/compose/.env 2>/dev/null || true
sudo chown nando:nando /srv/nando/secrets/* /srv/nando/compose/.env 2>/dev/null || true
```

Nota: `compose/.env` contiene solo variabili di interpolazione Compose (`POSTGRES_*`, `IMAGE_TAG`); i segreti applicativi stanno in `secrets/app.env`.

## Swap, timezone, log

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-nando.conf
sudo sysctl --system

sudo timedatectl set-timezone UTC
sudo systemctl enable --now systemd-timesyncd
```

Journald in `/etc/systemd/journald.conf`:

```text
SystemMaxUse=1G
SystemKeepFree=2G
MaxRetentionSec=14day
```

```bash
sudo systemctl restart systemd-journald
```

## Verifica

```bash
# solo 22 su Tailscale e porte localhost
sudo ss -tlnp

sudo ufw status verbose
sudo systemctl --failed
sudo docker run --rm hello-world
sudo tailscale status
sudo systemctl is-active cloudflared
```

Da un host esterno, verifica che 22/80/443 **non** siano raggiungibili sull'IP pubblico. Se lo sono, Docker o Dokploy stanno bypassando UFW: correggi prima di proseguire.

## Snapshot

Dopo il bootstrap, crea uno snapshot SSDNodes e annota la data in `maintenance-log.md`. È il punto di ripristino prima di installare l'app.
