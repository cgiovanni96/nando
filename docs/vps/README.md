# VPS Nando — documentazione operativa

> **⚠️ Superato in parte da [ADR-0010](../adr/0010-forma-del-repository-e-processi.md).** Questo documento descrive ancora un unico container `app`, un solo `app.env` e staging dietro Cloudflare Access. La topologia vigente è a tre processi (`web`, `api`, `worker`) più `migrate`, con staging solo sul tailnet e gestito da Dokploy. La riscrittura è tracciata in NAS-102.

**Stato:** infrastruttura configurata (2026-10-27); app non ancora deployata. I documenti descrivono lo stato attuale e le procedure per completarlo.
**Ultimo aggiornamento:** 2026-10-27
**Decisione:** [ADR-0009 — Hosting VPS-first fino a giugno 2027](../adr/0009-vps-first-hosting.md)

## Fatti

| Voce | Valore |
| --- | --- |
| Provider | SSDNodes (cloud VPS) |
| OS | Ubuntu 26.04 LTS "Resolute Raccoon" (`resolute`) |
| Risorse | 6 vCPU, 24 GB RAM, 400 GB disco |
| IP pubblico | `89.233.107.32` (nessuna porta in ingresso) |
| Dominio | `giovannicosta.me` (registrar GoDaddy) |
| DNS | Cloudflare (NS `carlane`/`jay.ns.cloudflare.com`, migrato 2026-10-27) |
| App produzione | `nando.giovannicosta.me` |
| Staging | `nando-staging.giovannicosta.me` |
| Admin / Dokploy | `admin.giovannicosta.me` |
| AI | provider esterni (OpenCode Go, OpenAI, Anthropic); nessun modello locale |
| Database | Postgres 17 + pgvector |
| Storage | Cloudflare R2 (S3) per allegati e backup |
| Email | Resend (record già presenti su `send` e `resend._domainkey`) |
| Ingresso | Cloudflare Tunnel + Access; nessuna porta 80/443 pubblica |

## Architettura

```text
Browser
  │ HTTPS
  ▼
Cloudflare (TLS, WAF, Access)
  │ Tunnel cifrato
  ▼
VPS 89.233.107.32
  ├── cloudflared
  │     ├── nando.giovannicosta.me   -> 127.0.0.1:3001  app produzione
  │     ├── nando-staging...         -> 127.0.0.1:3002  app staging
  │     └── admin.giovannicosta.me   -> 127.0.0.1:3000  Dokploy (opzionale)
  ├── Docker
  │     ├── app produzione
  │     ├── app staging
  │     ├── Postgres 17 + pgvector
  │     └── pg-boss (schema nello stesso Postgres)
  ├── restic -> R2 (backup cifrati)
  └── HTTPS in uscita -> provider AI esterni
```

Nessun servizio applicativo ascolta su interfacce pubbliche. Le porte pubblicate da Docker sono bindate a `127.0.0.1`; l'unico ingresso è il Tunnel.

## Mappa dei documenti

| Documento | Contenuto |
| --- | --- |
| [01-domain.md](01-domain.md) | GoDaddy → Cloudflare, record DNS, Resend, Tunnel, Access, TLS |
| [02-vps.md](02-vps.md) | Bootstrap Ubuntu, utenti, SSH, firewall, Docker, Tailscale, cloudflared, directory |
| [03-stack.md](03-stack.md) | Postgres, app, pg-boss, R2, Resend, AI provider, Dokploy, `.env` |
| [04-delivery.md](04-delivery.md) | GitHub Actions, immagini, staging/prod, migrazioni, rollback |
| [05-operations.md](05-operations.md) | Backup, restore, monitoraggio, manutenzione periodica, runbook |
| [06-llm-access.md](06-llm-access.md) | Accesso SSH per un agente LLM, chiavi, regole, revoca |
| [AGENT.md](AGENT.md) | Contratto operativo per l'agente di manutenzione (leggere per primo) |
| [maintenance-log.md](maintenance-log.md) | Registro delle manutenzioni |
| [scripts/](scripts/) | `nando-health`, `nando-backup`, `nando-restore-test` |

## Regole d'oro

1. **Core portabile:** Postgres, S3, Docker, Node. Niente D1, Queues, Workflows o Durable Objects nel dominio.
2. **Nessuna porta pubblica:** solo Cloudflare Tunnel. SSH via Tailscale o Cloudflare Access.
3. **Backup off-site + restore testato:** un backup mai ripristinato non è un backup.
4. **Segreti fuori dal repository:** `/srv/nando/compose/.env` e `/srv/nando/secrets` con permessi `600`; mai in chat o nei log.
5. **Un agente LLM opera con chiave dedicata:** read-only first, conferma per azioni distruttive, log di ogni comando.
6. **La VPS è un single point of failure:** monitoraggio esterno, snapshot, runbook.
7. **Scadenza giugno 2027:** migrazione pianificata, non subita. A inizio 2027 fare uno spike di migrazione.
8. **Nessun modello locale:** l'AI è esterna e sostituibile; la VPS non ha GPU.

## Ordine di lettura

- **Umano che configura:** 02 (bootstrap) → 01 (DNS, Tunnel, Access) → 03 (stack) → 04 (deploy) → 05 (operations). La migrazione DNS di 01 può precedere il bootstrap; il Tunnel richiede `cloudflared` di 02.
- **Agente LLM:** [AGENT.md](AGENT.md) → 06 → 05 → 03.
- **Incidente:** 05, sezione Runbook.

L'agente legge questi documenti dal repository. Se opera solo via SSH, copia `docs/vps` in `/srv/nando/docs/vps` (read-only) o clona il repository in `/srv/nando/repo`.

## Checklist di setup

- [x] Zona DNS su Cloudflare, record Resend preservati, nameserver GoDaddy aggiornati
- [x] Wildcard `*` e `_domainconnect` eliminati
- [x] Apex/`www` lasciati intatti (A proxied verso la VPS, oggi 522): riservati a un futuro portfolio, **nessun redirect** a `nando`
- [x] DNSSEC attivato su Cloudflare — status `pending`, DS non inseribile da GoDaddy con NS esterni (accettato: senza DS non c'è validazione né rischio)
- [x] `min_tls_version=1.2`, `always_use_https=on`, SSL/TLS mode `full`
- [x] Tunnel creato, Access su `nando`, `nando-staging`, `admin`
- [x] Ubuntu aggiornato, utente `nando`, SSH key-only, UFW, Tailscale
- [x] Docker, cloudflared, Dokploy (composto, senza Swarm/Traefik)
- [x] `/srv/nando` e `/srv/nando/secrets` con permessi corretti
- [x] Postgres healthy, estensioni `vector` e `pg_stat_statements`
- [ ] App produzione e staging healthy su `127.0.0.1` (bloccato: immagine `ghcr.io/cgiovanni96/nando` non esiste)
- [ ] Resend verificato dopo il cambio DNS
- [x] Backup restic su R2 + timer giornaliero
- [x] Restore test eseguito
- [ ] Monitoraggio esterno + alert — backup: healthchecks.io configurato; uptime: da fare (con Access servono un service token o un check interno)
- [x] `nando-agent` creato, chiave testata, sudoers ristretto
- [ ] Report e `maintenance-log.md` allineati

## Cosa non è ancora deciso

- Dokploy vs Docker Compose puro come interfaccia principale: il documento assume **Compose come sorgente di verità** e Dokploy come opzionale.
- Provider AI di default: la scelta resta dell'utente (ADR-0008).
- Landing page su `giovannicosta.me` e `www`: fuori da Nando v1.
- Provider di monitoraggio esterno: Uptime Kuma su un altro host o SaaS free.
