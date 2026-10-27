# 06 — Accesso alla VPS per un agente LLM

**Obiettivo:** un agente LLM può diagnosticare e manutenere la VPS senza password, senza porta SSH pubblica e senza vedere segreti. L'accesso è una chiave dedicata, revocabile in un minuto.

## Principi

1. **Mai chiavi private o password in chat.** La chiave privata resta sulla macchina dell'operatore; sulla VPS va solo la pubblica.
2. **Utente dedicato** `nando-agent`, separato da `nando` (umano) e `nando-deploy` (CI).
3. **SSH solo su Tailscale** (preferito) o Cloudflare Access SSH; niente 22 pubblico.
4. **Interfaccia stretta:** l'agente usa gli script `nando-*` per le operazioni comuni; per il resto chiede.
5. **Log e revoca:** ogni accesso è tracciabile; la chiave si ruota ogni trimestre.

## Metodo 1 — Tailscale + chiave SSH (consigliato)

### Sulla macchina dell'operatore

```powershell
ssh-keygen -t ed25519 -a 100 -f $env:USERPROFILE\.ssh\nando_agent -C "nando-agent@$(Get-Date -Format yyyy-MM-dd)"
Get-Content $env:USERPROFILE\.ssh\nando_agent.pub
```

Su Linux/macOS:

```bash
ssh-keygen -t ed25519 -a 100 -f ~/.ssh/nando_agent -C "nando-agent@$(date +%F)"
cat ~/.ssh/nando_agent.pub
```

### Sulla VPS

```bash
sudo adduser --disabled-password --gecos "" nando-agent
# Non aggiungere nando-agent al gruppo sudo: il drop-in sotto concede solo gli script.
sudo install -d -m 700 -o nando-agent -g nando-agent /home/nando-agent/.ssh
sudo install -d -m 750 -o nando-agent -g nando-agent /home/nando-agent/logs
```

Aggiungi la pubblica a `/home/nando-agent/.ssh/authorized_keys` con restrizioni:

```text
from="100.64.0.0/10",no-agent-forwarding,no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAA... nando-agent@2026-10-27
```

`100.64.0.0/10` è il range Tailscale. Se usi un IP statico, sostituiscilo. Non mettere `restrict` se l'agente deve avere una PTY per `sudo`; le opzioni sopra bastano. Se usi **Cloudflare Access SSH**, ometti `from=` o usa il range Cloudflare: il `ProxyCommand` gestisce l'accesso.

### Tailscale ACL

```json
{
  "tagOwners": {
    "tag:nando-vps": ["group:admins"],
    "tag:agent": ["group:admins"]
  },
  "acls": [
    { "action": "accept", "src": ["tag:agent"], "dst": ["tag:nando-vps:22"] }
  ]
}
```

L'agente entra solo sulla porta 22 della VPS, non sulla rete interna.

### Test

```bash
ssh -i ~/.ssh/nando_agent nando-agent@nando-vps \
  'hostname; id; sudo -n /usr/local/sbin/nando-health >/dev/null && echo sudo-ok'
```

## Metodo 2 — Cloudflare Access SSH

Se non vuoi Tailscale:

1. Zero Trust → **Access** → **Applications** → **Self-hosted** → `ssh.giovannicosta.me`.
2. Policy `Allow` sulla tua email + MFA.
3. Sulla VPS, `cloudflared` deve avere un ingress `ssh.giovannicosta.me` → `ssh://localhost:22`, e in Cloudflare un CNAME `ssh` verso il tunnel.
4. Sulla macchina dell'operatore:

```bash
cloudflared access ssh --hostname ssh.giovannicosta.me
```

`~/.ssh/config`:

```text
Host nando-vps
  HostName ssh.giovannicosta.me
  User nando-agent
  ProxyCommand cloudflared access ssh --hostname %h
```

È più macchinoso di Tailscale, ma non richiede un client VPN sempre attivo.

## Metodo 3 — SSH pubblico con allowlist (fallback)

Solo se Tailscale/Access non sono praticabili:

```bash
sudo ufw allow from <ADMIN_IP> to any port 22 proto tcp
```

- `PasswordAuthentication no`, `PermitRootLogin no`.
- `fail2ban` attivo.
- Chiave dedicata, `from=` sull'IP.
- Non usare la porta 22 aperta al mondo.

## Utente e permessi

### Modalità routine (consigliata)

L'agente esegue solo gli script e i comandi read-only. Crea il drop-in:

```bash
sudo tee /etc/sudoers.d/nando-agent >/dev/null <<'EOF'
nando-agent ALL=(ALL) NOPASSWD: /usr/local/sbin/nando-health
nando-agent ALL=(ALL) NOPASSWD: /usr/local/sbin/nando-health --full
nando-agent ALL=(ALL) NOPASSWD: /usr/local/sbin/nando-backup
nando-agent ALL=(ALL) NOPASSWD: /usr/local/sbin/nando-restore-test
EOF
sudo chmod 440 /etc/sudoers.d/nando-agent
sudo visudo -c
```

Con questa modalità l'agente **non** può fare upgrade, modificare `/etc` o cancellare volumi. Prepara il piano; l'umano esegue.

### Modalità estesa (solo se accetti il rischio)

Se vuoi che l'agente faccia anche `apt`, `docker`, `systemctl`, sostituisci il drop-in con:

```text
nando-agent ALL=(ALL) NOPASSWD: ALL
```

In cambio, `AGENT.md` impone: read-only first, conferma per azioni distruttive, backup prima degli upgrade, log di ogni comando. La modalità estesa è potente: una chiave compromessa è root. Valuta una chiave separata per il break-glass e ruotala spesso.

## Segreti

- L'agente **non** deve `cat /srv/nando/secrets/*` né `.env`.
- Se deve verificare una chiave, controlla solo presenza, lunghezza o prefisso, mai il valore.
- I comandi che usano segreti li leggono dal file con permessi `600`; l'output non deve contenerli.
- Nei report: `REDACTED` per token, password, chiavi AI, URL firmati.

## Contratto operativo

L'agente legge [AGENT.md](AGENT.md) all'inizio di ogni sessione. In sintesi:

- inizia con `nando-health` e `date -u`; non modifica nulla senza proposta;
- usa gli script, non reinventa comandi;
- backup/snapshot prima di ogni modifica;
- niente DNS, Access, chiavi, deploy o migrazioni senza umano;
- stop su disco >85%, backup >48h, DB down, errori ripetuti;
- scrive un report in `/home/nando-agent/logs/`.

L'agente legge i documenti dal repository. Se opera solo via SSH, `/srv/nando/docs/vps` deve contenere una copia read-only di questa documentazione.

## Prompt di avvio (esempio)

```text
Sei l'agente di manutenzione della VPS Nando.
Leggi docs/vps/AGENT.md e docs/vps/05-operations.md prima di agire.
Accedi con: ssh nando-agent@nando-vps.
Esegui prima `sudo nando-health`, poi riporta. Non modificare nulla senza conferma esplicita.
Non stampare segreti. Non cambiare DNS, Access, chiavi o deploy.
```

## Rotazione e revoca

### Rotazione trimestrale

1. Genera una nuova chiave con commento e data.
2. Aggiungi la pubblica a `authorized_keys`.
3. Testa il login.
4. Rimuovi la vecchia riga.
5. Aggiorna il password manager e `maintenance-log.md`.

### Revoca immediata

```bash
sudo sed -i '/nando-agent@2026-10-27/d' /home/nando-agent/.ssh/authorized_keys
```

Poi:

- revoca il device su Tailscale (se usato);
- `sudo pkill -u nando-agent` per chiudere le sessioni attive;
- controlla `last`, `/var/log/auth.log`, `journalctl -u ssh`;
- annota l'incidente.

## Audit

- `authorized_keys` con commento `owner@data`.
- `sudo` log in `/var/log/auth.log`.
- `journalctl -u ssh`.
- Log dell'agente in `/home/nando-agent/logs/YYYY-MM-DD.log`.
- Review mensile: chi ha accesso, quando, da dove.

## Test di accettazione

```bash
# 1. login
ssh -i ~/.ssh/nando_agent nando-agent@nando-vps 'hostname; whoami; date -u'

# 2. sudo ristretto
ssh -i ~/.ssh/nando_agent nando-agent@nando-vps 'sudo -n /usr/local/sbin/nando-health | head -20'

# 3. comando non permesso (deve fallire in modalità routine)
ssh -i ~/.ssh/nando_agent nando-agent@nando-vps 'sudo -n apt update' || echo 'atteso: permesso negato'

# 4. niente porta pubblica
# da un host esterno: nc -vz 89.233.107.32 22 deve fallire
```

## Limitazioni

- L'agente non è un demone: non monitora 24/7. Il monitoraggio è esterno; la manutenzione periodica è su timer o su richiesta.
- L'agente non sostituisce un backup testato.
- L'agente non deve fare da solo major upgrade, migrazioni di produzione o modifiche DNS/Access.
- Se Tailscale è giù, l'accesso dell'agente è giù: tieni un break-glass umano (console SSDNodes + chiave di emergenza).
