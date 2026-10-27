# 0009 — Hosting VPS-first fino a giugno 2027

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-51 — Stack, repo e deployment (in corso)
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

La VPS è già pagata fino a giugno 2027: SSDNodes, Ubuntu 24.04, 6 vCPU, 24 GB RAM, 400 GB disco, IP `89.233.107.32`. Non ha GPU. L'utente non vuole aggiungere spese fisse e userà provider AI esterni (OpenCode Go, OpenAI, Anthropic); nessun modello locale.

Il piano Cloudflare-first di NAS-48 resta un input tecnico valido, ma il piano Workers **Free** non regge il carico previsto: 10 ms di CPU per richiesta contro i 10–20 ms tipici del SSR di TanStack Start. Il piano Workers Paid ($5/mese) sarebbe la baseline Cloudflare. Dato che la VPS è già pagata, il costo marginale di ospitare Nando lì è zero; il costo reale è operativo.

Il dominio `giovannicosta.me` è registrato su GoDaddy, con DNS su GoDaddy, senza email sull'apex e senza DNSSEC. Ci sono record Resend attivi su `send` e `resend._domainkey`; vanno preservati.

## Decisione

Nando gira sulla VPS fino a giugno 2027, con un core portabile e un'uscita a basso costo.

### Runtime e dati

- **Postgres 17 + pgvector** come database unico; Drizzle come ORM e migrazioni versionate.
- **Node 24 LTS** con TanStack Start + Hono; un solo processo applicativo per ambiente.
- **Docker Compose** come sorgente di verità del deployment; Dokploy è opzionale, per comodità di UI e deploy.
- **pg-boss** per i job differiti, sullo stesso Postgres; niente Redis obbligatorio.
- **R2** (S3-compatibile) per allegati e backup; MinIO solo se si vuole azzerare la dipendenza Cloudflare.
- **Resend** per l'invio email; i record DNS esistenti vanno mantenuti.
- **Nessun modello locale**: l'AI usa provider esterni via HTTPS in uscita.

### Ingresso e sicurezza

- **Cloudflare Tunnel + Access** davanti a `nando`, `staging` e `admin`; nessuna porta 80/443 pubblica.
- **SSH solo via Tailscale** (preferito) o Cloudflare Access SSH; in fallback, chiave + allowlist IP.
- **UFW** deny-by-default, `fail2ban`, `unattended-upgrades`, Docker con porte pubblicate solo su `127.0.0.1`.
- Segreti in `/srv/nando/secrets` e `.env` con permessi `600`; mai nel repository o in chat.

### Ambienti e deploy

- **Locale** con Docker Compose e Postgres locale.
- **Staging** sulla stessa VPS, con database, volumi, porte ed env separati.
- **Produzione** sulla stessa VPS, dietro Access.
- **GitHub Actions** per build, test, push su GHCR e deploy; migrazioni esplicite, backup prima del deploy.
- **Nessun fallback automatico** tra provider AI; la scelta del modello resta dell'utente (ADR-0008).

### Portabilità e uscita

Il core non deve dipendere dalla VPS né da primitive Cloudflare-specifiche:

- niente D1, Queues, Workflows o Durable Objects nel dominio;
- Postgres standard, storage S3-compatibile, job su Postgres, runtime Node/Docker;
- `docker-compose.yml`, migrazioni e runbook nel repository;
- backup indipendenti dal provider, con restore testato;
- migrazione a un altro VPS/cloud container: dump Postgres + immagini + storage + DNS;
- migrazione a Cloudflare Workers: port del runtime, Hyperdrive/Neon, R2, Queues/Workflows al posto di pg-boss.

La scadenza di giugno 2027 è un forcing function: a inizio 2027 si fa uno spike di migrazione e si decide se restare, cambiare VPS o passare a Cloudflare/altro.

## Conseguenze

- **NAS-51**: la scelta Cloudflare-first viene sostituita da VPS-first; il repository resta un monorepo lite, ma il runtime è Node/Docker, non Workers.
- **NAS-48**: la ricerca Cloudflare resta un input, non un vincolo. D1/Queues/Workflows non entrano nel core.
- **NAS-47**: persistenza e backup su Postgres; retention e restore con `pg_dump` + restic.
- **NAS-59**: ricerca e embedding possono usare pgvector; nessun bisogno di D1/Vectorize.
- **NAS-50**: Access come cancello di fase 1; Better Auth in Postgres per `userId`, sessioni e passkey in fase 2.
- **ADR-0008**: la policy AI resta valida; cambia solo la piattaforma che la ospita.
- **Operazioni**: backup, monitoring e manutenzione periodica diventano responsabilità di Nando; documentati in `docs/vps/`.

## Invarianti

1. Il core è portabile: Postgres, S3, Docker, Node; nessuna primitiva proprietaria nel dominio.
2. Nessuna porta pubblica: solo Tunnel; SSH via Tailscale/Access.
3. Backup off-site e restore testato prima di considerare la VPS un daily driver.
4. Segreti fuori dal repository, con permessi `600`.
5. Nessun modello locale; l'AI è esterna e sostituibile.
6. Staging e produzione condividono la VPS ma non database, volumi, porte o segreti.
7. La VPS è un single point of failure: monitoring e runbook sono obbligatori.
8. La migrazione del 2027 è pianificata, non subita.

## Alternative scartate

- **Cloudflare Workers Paid ($5/mese)**: migliore in ops e affidabilità, ma aggiunge una spesa fissa che l'utente non vuole; la VPS è già pagata.
- **Cloudflare Workers Free**: 10 ms di CPU non reggono il SSR di TanStack Start; false economy.
- **PaaS gestito (Fly.io, Railway, Render)**: meno ops, ma costo variabile e lock-in; non necessario con la VPS disponibile.
- **D1 + Workers**: veloce da avviare, ma lega il progetto a Cloudflare e rende la migrazione del 2027 più costosa.
- **Modelli locali sulla VPS**: niente GPU, qualità e latenza inadatte alle Proposal; l'AI resta esterna.
- **Coolify al posto di Dokploy**: entrambi validi; Dokploy è più leggero per un singolo VPS. La scelta è reversibile.
