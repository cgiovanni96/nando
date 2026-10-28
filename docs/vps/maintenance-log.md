# Maintenance log

Registro append-only delle manutenzioni. Una riga per intervento; i dettagli stanno nel report della sessione.

| Data (UTC) | Attore | Tipo | Azione | Esito | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-10-27 | umano | setup | Documentazione VPS creata | OK | Target, non ancora eseguito |
| 2026-10-27 18:30 | umano+agente | setup | Bootstrap VPS: hostname `nando-vps`, utenti `nando`/`nando-agent`, chiavi, pacchetti base, fail2ban, swap 4G, journald, unattended-upgrades | OK | OS reale: Ubuntu 26.04 LTS `resolute` |
| 2026-10-27 18:50 | agente | setup | Tailscale attivo su VPS e client Windows; UFW `deny incoming` + 22 solo su `tailscale0` | OK | 22 pubblica chiusa, verificata dall'esterno |
| 2026-10-27 18:54 | agente | setup | Hardening sshd: `00-nando.conf` (non `99-`), password auth off, root off, `AllowUsers` | OK | Verificato: password e root rifiutati |
| 2026-10-27 18:57 | agente | setup | Docker 29.9.2 + Compose 5.6.1, `daemon.json` (log rotation, live-restore) | OK | |
| 2026-10-27 18:58 | agente | setup | Dokploy in Compose senza Swarm/Traefik, dashboard `127.0.0.1:3000` | OK | Installer ufficiale scartato: esponeva 80/443/3000 |
| 2026-10-27 19:00 | agente | setup | Postgres 17.11 pgvector healthy, estensioni `vector`, `pg_stat_statements`, `pgcrypto` | OK | 5432 non pubblicata |
| 2026-10-27 19:15 | umano | setup | DNS migrato a Cloudflare (`carlane`/`jay`), tunnel `nando` con 3 hostname | OK | Wildcard `*` ancora da rimuovere |
| 2026-10-27 21:10 | agente | setup | 3 app Cloudflare Access + policy `allow-owner` su `nando`, `nando-staging`, `admin` | OK | Applicazione edge con ~10 min di ritardo |
| 2026-10-27 21:13 | agente | backup | `restic init` su R2 + primo backup (snapshot `ebb32ea9`) + `restic check` | OK | Bug corretto in `nando-backup.sh`: mancava `set -a` |
| 2026-10-27 21:14 | agente | restore-test | Ripristino su `nando_restore_test_*` dal dump `20261027T211327Z` | OK | Database di test rimosso |
| 2026-10-27 21:14 | agente | setup | Timer `nando-backup.timer` attivo (03:00 UTC) | OK | Prossima esecuzione 2026-10-28 03:03 UTC |
| 2026-10-27 21:25 | agente | setup | DNS: eliminati `*` e `_domainconnect`; `min_tls_version=1.2`, `always_use_https=on` | OK | Import iniziale: 11 record corretti, SSL mode già `full` |
| 2026-10-27 21:27 | agente | setup | DNSSEC attivato su Cloudflare (key tag 2371, SHA256) | WARN | Status `pending`: manca il DS su GoDaddy |
| 2026-10-27 21:35 | umano | setup | Password impostata per `nando`; rimosso `/etc/sudoers.d/99-setup-temp` | OK | `sudo` ora richiede password; da qui l'agente non ha più root |
| 2026-10-27 21:35 | agente | review | Aperti: redirect apex/`www`, header di sicurezza, HSTS, Resend da verificare, healthchecks.io, deploy app | WARN | Redirect bloccato dal permesso `Config Rules` sul token API |
| 2026-10-28 | umano | review | Decisione: apex e `www` non vengono rediretti a `nando`; restano riservati a un futuro portfolio | OK | Oggi rispondono `522`, accettato. Token `nando-dns` non necessita di `Config Rules` |
| 2026-10-28 | umano | review | GoDaddy non consente più la modifica della zona DNS dopo il cambio NS | OK | Atteso: DS/DNSSEC è livello registrar, non zona. DNSSEC lasciato `pending` |
| 2026-10-28 | agente | setup | `HEALTHCHECKS_BACKUP_URL` impostato in `restic.env`, ping di prova `200` | OK | Alert se il backup non gira da 26 h. `HEALTHCHECKS_RESTORE_URL` ancora vuoto |
| 2026-10-28 | umano | backup | `nando-backup` e `nando-restore-test` eseguiti a mano: entrambi con `healthchecks ping ok` | OK | `HEALTHCHECKS_RESTORE_URL` impostato. Catena backup+restore+alert completa |
| 2026-10-28 08:27 | agente | setup | `nando-deploy` creato, wrapper installato, sudoers ristretto; progetto Compose rinominato `compose` → `nando` | OK | Errore iniziale per ordine sbagliato (backup dopo la sostituzione del compose): corretto |
| 2026-10-28 08:35 | agente | setup | GitHub: environment `staging` e `production` (required reviewer), secret `VPS_*` e `TS_*` sui due | OK | Secret environment-scoped, non di repository |
| 2026-10-28 08:53 | agente | review | Workflow `ci-smoke` eseguito: runner GitHub → Tailscale `tag:ci` → SSH `nando-deploy` → wrapper | OK | Verificato anche che `sudo docker ps` sia negato dal runner. Run `40660000026` |

## Tipi

- `setup` — bootstrap, DNS, Tunnel, Access.
- `deploy` — rilascio applicativo.
- `backup` — backup manuale o verifica.
- `restore-test` — restore di prova.
- `patch` — aggiornamenti OS/Docker/app.
- `incident` — outage, sicurezza, corruzione.
- `review` — audit accessi, costi, retention.

## Regole

- Non riscrivere righe passate; aggiungi una correzione.
- Niente segreti, token, prompt o contenuti utente.
- Se un intervento fallisce, indica il rollback e lo stato finale.
- Per i restore test, indica il dump usato e l'esito della verifica.
