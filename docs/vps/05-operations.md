# 05 — Operazioni, backup e manutenzione

**Obiettivo:** la VPS resta aggiornata, i dati sono recuperabili e i problemi vengono visti prima che diventino incidenti. La manutenzione ordinaria è automatizzata o eseguita da un agente LLM con un contratto esplicito.

## Obiettivi di ripristino

| Metrica | Target v1 |
| --- | --- |
| RPO (dati persi al massimo) | 24 ore |
| RTO (tempo di ripristino) | 2–4 ore |
| Retention backup | 30 giornalieri, 12 settimanali, 12 mensili |
| Restore test | mensile |
| DR drill | trimestrale |

Se questi target non sono realistici, vanno decisi prima di chiamare la VPS "daily driver".

## Backup

### Cosa si salva

- **Postgres**: dump logico `pg_dump -Fc` giornaliero, dal database dell'applicazione in Dokploy (`nando_staging`). Il container viene risolto per etichetta Compose (`project=nando-staging`, `service=db`), perché Dokploy genera nomi che cambiano; il vecchio database del progetto `/srv/nando/compose` (`nando`) non è più quello dei dati.
- **Manifest**: accanto a ogni dump, `nando-backup` scrive `*.manifest.json` con conteggi per tabella, versione del journal Drizzle, `sha256` e dimensione del dump. Senza manifest un dump non è verificabile.
- **File applicativi**: `/srv/nando` (compose, env cifrato? no: env escluso dal repo ma incluso nel backup cifrato), volumi non-database.
- **Configurazione**: `/srv/nando/compose`, `/srv/nando/secrets` (il repository restic è cifrato), `/etc/cloudflared`, `/etc/dokploy` se usato, le unità `nando-*` e `/etc/docker/daemon.json`.
- **Segreti**: inclusi nel restic cifrato; la password del repository e le credenziali R2 stanno nel password manager, non solo sulla VPS.

### Dove

- Repository restic su **R2** (`nando-backups`), cifrato lato client.
- Copia locale breve in `/srv/nando/backups/db` (7 giorni) per restore rapidi.
- Bucket **`nando-assets`** per gli allegati, con copia giornaliera in **`nando-assets-snapshots`** (lifecycle 90 giorni): il dump e restic non toccano gli oggetti, e R2 non offre versioning S3.
- Bucket **`nando-exports`** privato per gli archivi di export (12 mesi).
- Snapshot SSDNodes come ultima spiaggia, non come strategia.

### R2: bucket e snapshot degli allegati

R2 **non supporta il versioning S3**: `PutBucketVersioning` è assente e `GetBucketVersioning` è un dummy che risponde sempre "mai versionato". La copia fuori dal bucket è quindi uno **snapshot giornaliero** in un secondo bucket, non una versione dell'oggetto.

Da configurare una volta, dal dashboard R2 o con `aws s3api --endpoint-url <R2_ENDPOINT>`:

1. **`nando-assets`**: bucket privato degli allegati.
2. **`nando-assets-snapshots`**: privato; lifecycle che scade gli oggetti dopo 90 giorni. Il prefisso usato è `snapshots/<YYYY-MM-DD>/`.
3. **`nando-exports`**: privato; lifecycle dopo 365 giorni (12 archivi mensili). Nessun dominio pubblico, nessun `r2.dev`.
4. Token R2 con object read/write sui quattro bucket (`nando-backups`, `nando-assets`, `nando-assets-snapshots`, `nando-exports`). Un token limitato a `nando-backups` non basta per export e snapshot.

La copia la fa `nando-assets-snapshot` (sotto), non il versioning: un oggetto cancellato dal bucket live resta negli snapshot precedenti finché la lifecycle non li scade. Non si usa un **bucket lock**, che impedirebbe anche le cancellazioni legittime previste da ADR-0011.

### Script

Vedi `scripts/nando-backup.sh`. Installazione:

```bash
sudo install -m 755 docs/vps/scripts/nando-health.sh /usr/local/sbin/nando-health
sudo install -m 755 docs/vps/scripts/nando-backup.sh /usr/local/sbin/nando-backup
sudo install -m 755 docs/vps/scripts/nando-restore-test.sh /usr/local/sbin/nando-restore-test
```

Variabili in `/srv/nando/secrets/restic.env` (permessi `600`):

```text
RESTIC_REPOSITORY=s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/nando-backups
RESTIC_PASSWORD_FILE=/srv/nando/secrets/restic-password
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=auto
HEALTHCHECKS_BACKUP_URL=
HEALTHCHECKS_RESTORE_URL=
```

Variabili opzionali per il database, con questi default:

```text
DB_PROJECT=nando-staging
DB_SERVICE=db
DB_NAME=nando_staging
DB_USER=nando
# DB_CONTAINER=   # ha precedenza; utile se le etichette non bastano
```

`DB_PROJECT` vale come nome esatto oppure come prefisso: Dokploy aggiunge un suffisso
(`nando-staging-iilphp`), quindi `nando-staging` trova il progetto giusto. Se il prefisso
corrisponde a più progetti, lo script si ferma e li elenca — meglio nessun dump che il dump
sbagliato. Se il progetto Dokploy cambia nome:

```bash
sudo docker ps --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}'
```

Poi si aggiorna `DB_PROJECT` in `restic.env`. La produzione di M7 avrà il proprio progetto: lo stesso file dovrà puntare lì al cutover.

### Timer giornaliero

`/etc/systemd/system/nando-backup.service`:

```ini
[Unit]
Description=Nando backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/nando-backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
```

`/etc/systemd/system/nando-backup.timer`:

```ini
[Unit]
Description=Daily Nando backup

[Timer]
OnCalendar=*-*-* 03:00:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nando-backup.timer
systemctl list-timers --all | grep nando
```

### Snapshot degli allegati

`nando-assets-snapshot` copia `nando-assets` in `nando-assets-snapshots/snapshots/<YYYY-MM-DD>/`:

```bash
sudo install -m 755 docs/vps/scripts/nando-assets-snapshot.sh /usr/local/sbin/nando-assets-snapshot
sudo /usr/local/sbin/nando-assets-snapshot
```

Variabili opzionali in `restic.env`: `ASSETS_BUCKET`, `ASSETS_SNAPSHOT_BUCKET`, `SNAPSHOT_PREFIX`, `HEALTHCHECKS_ASSETS_URL`.

`/etc/systemd/system/nando-assets-snapshot.service`:

```ini
[Unit]
Description=Nando assets snapshot
After=docker.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/nando-assets-snapshot
```

`/etc/systemd/system/nando-assets-snapshot.timer`:

```ini
[Unit]
Description=Daily Nando assets snapshot

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Con zero allegati lo snapshot è vuoto e lo dice (`0 oggetti`): non è un errore. Gli allegati esistono da M4a.

### Restore test

```bash
sudo /usr/local/sbin/nando-restore-test
```

Lo script:

1. prende il dump più recente;
2. confronta lo `sha256` del dump con il manifest, se presente;
3. crea un database `nando_restore_test_*`;
4. esegue `pg_restore`;
5. verifica che le tabelle esistano e che una query semplice risponda;
6. elimina il database di test.

Non tocca il database dell'applicazione. Va eseguito **almeno una volta al mese**; l'esito va annotato in `maintenance-log.md`.

### Export

`nando-export` prende l'ultimo dump, ne deriva `schema.sql`, costruisce `counts.tsv`, `MANIFEST.json` e `README.md`, cifra tutto con `age` e carica l'archivio su `nando-exports`.

```bash
sudo apt-get install -y age awscli    # una tantum
sudo /usr/local/sbin/nando-export
```

Contenuto e formato sono in ADR-0011: `database.dump`, `schema.sql` derivato dal dump (non dal database), conteggi per tabella, `sha256` di ogni parte, tag immagine e versione del journal.

Gli **allegati** entrano nell'export con Knowledge (M4a): fino ad allora `attachments` è vuoto e i file vivono negli snapshot di `nando-assets-snapshots`. Quando M4a arriva, `nando-export` deve scaricarli da R2 e includerli con il proprio `sha256`.

Chiave:

- **pubblica** in `/srv/nando/secrets/age-public.key` (root, `600`), usata dal job;
- **privata** solo nel password manager, mai sulla VPS;
- senza la privata l'archivio non è leggibile, per scelta.

Variabili (in `restic.env` o nell'ambiente):

```text
EXPORTS_BUCKET=nando-exports
AGE_RECIPIENT_FILE=/srv/nando/secrets/age-public.key
# R2_ENDPOINT è derivato da RESTIC_REPOSITORY
```

Retention: 12 archivi, sia in `/srv/nando/exports` sia sul bucket (lifecycle 365 giorni).

Verifica mensile, con la chiave privata presa dal password manager solo per il test:

```bash
# copia la privata in /root/age-test.key, poi
sudo AGE_IDENTITY_FILE=/root/age-test.key /usr/local/sbin/nando-restore-test --export
sudo shred -u /root/age-test.key
```

Lo script decifra l'archivio, confronta lo `sha256` di ogni parte con il manifest, ripristina `database.dump` in un database temporaneo e confronta i conteggi per tabella. Se il manifest non torna, fallisce.

## Monitoraggio

### Esterno

- **Uptime**: Better Stack / UptimeRobot / Uptime Kuma su un altro host. Monitora `https://nando.giovannicosta.me`; un `302` di Access significa che l'edge è su, non che l'app è sana.
- **App health**: service token Access verso `/api/health`, oppure un check interno via Tailscale.
- **Backup**: `healthchecks.io` con ping alla fine di `nando-backup`; alert se manca il ping per 26 ore.
- **Tunnel**: `systemctl status cloudflared` + un check HTTPS esterno.
- **Disco**: alert a 75% (warning) e 85% (critical).
- **AI provider**: errori/rate limit nei log; costo dai dashboard dei provider.

### Interno

```bash
sudo /usr/local/sbin/nando-health
sudo docker compose ps
sudo docker stats --no-stream
df -h /
free -h
sudo systemctl --failed
sudo journalctl -p err --since "7 days ago" --no-pager | tail -50
sudo fail2ban-client status sshd
```

> Finché l'app non è deployata, `nando-health` esce con `2` (FAIL) perché `127.0.0.1:3001` e `3002` non rispondono: è atteso. Non è una stop condition.

> `nando-backup` legge `restic.env` con `set -a`: le variabili (`RESTIC_REPOSITORY`, `AWS_*`) devono essere esportate, altrimenti restic non trova il repository. Se modifichi lo script, mantieni quel `set -a`.

### Soglie

| Segnale | Warning | Critical |
| --- | --- | --- |
| Disco `/` | 75% | 85% |
| Backup più recente | 26 h | 48 h |
| App health | 2 check falliti | 5 min down |
| DB | `pg_isready` lento | non risponde |
| Container restart | 1 in 24 h | 3 in 24 h |
| Tunnel | restart | down |
| Certificato (se diretto) | 14 giorni | 7 giorni |
| Errori 5xx | >1% | >5% |

## Manutenzione settimanale (agente)

Eseguire ogni lunedì, o su richiesta. Non fare upgrade senza approvazione.

1. Leggere `AGENT.md` e l'ultima riga di `maintenance-log.md`.
2. `ssh nando-agent@nando-vps`, `date -u`, `hostname`, `sudo -n true`.
3. `sudo /usr/local/sbin/nando-health`.
4. Verificare backup:
   ```bash
   sudo ls -lh /srv/nando/backups/db | tail -5
   sudo bash -c 'set -a; . /srv/nando/secrets/restic.env; set +a; restic snapshots --last'
   ```
5. Disco e immagini:
   ```bash
   df -h /
   sudo docker system df
   ```
   Se disco >75%, pulire log vecchi, dump locali oltre 7 giorni e immagini non usate (`docker image prune -f`), mai volumi.
6. Container:
   ```bash
   sudo docker compose ps
   sudo docker ps --filter health=unhealthy
   sudo docker events --since 168h --until 0s --filter event=restart | tail -20
   ```
7. Log:
   ```bash
   sudo journalctl -p err --since "7 days ago" --no-pager | tail -50
   sudo docker compose logs --since 168h app | grep -Ei 'error|fatal|exception' | tail -50
   ```
8. Aggiornamenti disponibili (solo report):
   ```bash
   sudo apt update
   apt list --upgradable 2>/dev/null | head -50
   ```
9. Sicurezza:
   ```bash
   sudo last -a | head -20
   sudo lastb -a | head -20
   sudo fail2ban-client status sshd
   sudo ss -tlnp
   ```
10. Scrivere il report (template sotto) in `/home/nando-agent/logs/YYYY-MM-DD.md` e, se il repo è disponibile, aggiungere una riga a `docs/vps/maintenance-log.md`. Se ci sono warning, proporre il fix; non applicarlo senza conferma.

## Manutenzione mensile (agente + approvazione)

1. **Snapshot SSDNodes** e annotazione.
2. **Backup manuale** prima degli upgrade: `sudo /usr/local/sbin/nando-backup`.
3. **Ubuntu**:
   ```bash
   sudo apt update
   sudo apt full-upgrade -y
   sudo needrestart -r l
   ```
   Riavvia se il kernel lo richiede; verifica i servizi dopo il reboot.
4. **Immagini Docker non-app** (Postgres minor, cloudflared, Dokploy): aggiorna i tag in modo controllato, `docker compose pull`, `up -d`, verifica. Non fare major upgrade di Postgres senza piano.
5. **App**: aggiorna solo via CI/CD, non con `docker compose pull` manuale in produzione.
6. **Pulizia**: `sudo docker image prune -f`; non `-a`, non `--volumes`.
7. **Restore test**: `sudo /usr/local/sbin/nando-restore-test`; una volta al mese `sudo /usr/local/sbin/nando-export` seguito da `--export` con la chiave age, come sopra.
8. **Restic check**: `sudo bash -c 'set -a; . /srv/nando/secrets/restic.env; set +a; restic check --read-data-subset=10%'`.
9. **Postgres**: `pg_stat_statements`, query lente, connessioni, dimensione DB; valuta `VACUUM (ANALYZE)` solo se necessario. Non `VACUUM FULL` senza piano.
10. **Accessi**: `getent passwd`, `sudo -l`, `authorized_keys`, `last`; rimuovi chiavi non più usate.
11. **Cloudflare**: Access policy, DNS, Tunnel, Resend verified.
12. **Documentazione**: aggiorna `maintenance-log.md` e questo file se cambia qualcosa.

## Manutenzione trimestrale

- **DR drill**: ricostruisci staging da zero su una VPS temporanea o su un ambiente locale; ripristina DB e file; misura il tempo.
- **Rotazione chiavi**: `nando-agent`, `nando-deploy`; aggiorna `authorized_keys` e GitHub Secrets.
- **Major upgrade**: Node, Postgres, Dokploy; pianifica, testa su staging, backup.
- **Retention/costi**: R2, Cloudflare, provider AI; verifica che i backup siano nei limiti.
- **Sicurezza**: `ssh-audit` se disponibile, rassegna `ufw`/`fail2ban`, verifica porte esposte.
- **Review ADR**: ADR-0009 e la scadenza giugno 2027; pianifica lo spike di migrazione.

## Template report

```markdown
# Report manutenzione — YYYY-MM-DD

- Host: nando-vps
- Agente:
- Finestra:
- Esito: OK | WARN | FAIL

## Check
| Check | Esito | Dettaglio |
| --- | --- | --- |
| App produzione | OK | /api/health 200 |
| App staging | OK | /api/health 200 |
| Postgres | OK | pg_isready |
| Backup | OK | ultimo 2026-10-27T03:00Z |
| Disco | OK | 42% |
| Container | OK | 3/3 healthy |
| Tunnel | OK | attivo |
| Aggiornamenti | WARN | 6 pacchetti |
| Sicurezza | OK | 0 login falliti |

## Azioni eseguite
- ...

## Rischi / azioni proposte
- ...

## Prossimo passo
- ...
```

## Runbook

### App giù

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 app
curl -v http://127.0.0.1:3001/api/health
sudo docker compose exec -T db pg_isready -U nando -d nando
```

Se il DB è sano e l'app no: `docker compose restart app`; se persiste, rollback all'immagine precedente. Se il DB non risponde, vedi sotto.

### Postgres giù

```bash
sudo docker compose ps db
sudo docker compose logs --tail=200 db
df -h /
free -h
sudo docker compose restart db
```

Se il volume è corrotto: ferma l'app, ripristina l'ultimo dump su un database nuovo, verifica, ripunta l'app. Non cancellare il volume finché il dump non è verificato.

### Ripristino da backup (ADR-0011)

Il database vive nel progetto Dokploy `nando-staging`. Il ripristino non è un `docker compose up` del vecchio stack.

```bash
# 1. dump e manifest più recenti
sudo ls -lt /srv/nando/backups/db | head
sudo sha256sum /srv/nando/backups/db/nando-<stamp>.dump
# confronta lo sha256 con nando-<stamp>.manifest.json

# 2. container del database (nome generato da Dokploy)
sudo docker ps --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}'
```

1. Ferma `web` e `api` da Dokploy; lascia `db` attivo.
2. Ripristina in un database nuovo per non distruggere quello corrente:
   `createdb nando_restore`, poi `pg_restore --no-owner --no-privileges --exit-on-error -d nando_restore`.
3. Confronta i conteggi per tabella con `counts` nel manifest; se tornano, rinomina o ripunta `DATABASE_URL` e `POSTGRES_DB` al database ripristinato.
4. Ripristina `/srv/nando` da restic (`restic restore latest --target /`), poi riavvia i servizi da Dokploy con il tag del manifest.
5. Verifica `/healthz`, `/api/health` e la lettura di alcune entità reali.
6. Annota esito e durata in `maintenance-log.md`: l'RTO di 2–4 ore si misura.

Il ripristino in place (drop e recreate di `nando_staging`) è ammesso solo con l'app ferma e dopo che il dump ha superato il restore test: un dump mai ripristinato non è un backup.

### Disco pieno

```bash
df -h /
sudo du -sh /var/log /srv/nando/backups /var/lib/docker 2>/dev/null
sudo journalctl --disk-usage
sudo docker system df
```

Pulisci log vecchi, dump locali oltre 7 giorni, immagini non usate. **Mai** `docker system prune -a --volumes` e mai `rm -rf` su volumi o `/srv/nando`.

### Tunnel giù

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
```

Verifica token/scadenza nel dashboard Cloudflare. Nel frattempo accedi via Tailscale per diagnosticare. Non aprire 80/443 come scorciatoia.

### Deploy errato

```bash
cd /srv/nando/compose
export IMAGE_TAG=sha-<precedente>
sudo docker compose up -d app
curl -fsS http://127.0.0.1:3001/api/health
```

Se la migrazione è incompatibile, ripristina il dump pre-deploy su un DB nuovo e ripunta l'app.

### Chiave compromessa

1. Rimuovi la riga da `/home/nando-agent/.ssh/authorized_keys` (o `nando`).
2. Revoca il device Tailscale.
3. Ruota la chiave e aggiorna il password manager.
4. Controlla `last`, `auth.log`, `journalctl`, processi e connessioni.
5. Annota l'incidente.

### Provider AI fuori servizio

L'app deve restituire un errore chiaro e fermarsi; l'utente sceglie un altro modello. Non introdurre fallback automatici. Verifica i log metadata-only.

## Cose da non fare

- `docker system prune -a --volumes`
- `docker volume rm` o cancellazione di `/var/lib/docker`
- `DROP DATABASE`, `TRUNCATE`, `pg_resetwal`
- `rm -rf` fuori da `/tmp`
- modifica di `sshd_config` senza `sshd -t`
- apertura di 80/443 o di porte DB
- cancellazione di backup prima di un restore verificato
- major upgrade senza snapshot e test su staging
- `curl | sh` senza aver letto lo script
- stampa di segreti in chat, log o report
