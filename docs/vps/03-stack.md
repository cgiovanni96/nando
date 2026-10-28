# 03 — Stack applicativo

> **⚠️ Superato in parte da [ADR-0010](../adr/0010-forma-del-repository-e-processi.md).** Un solo container `app` e un solo `app.env` non esistono più: servono `web`, `api`, `worker` e `migrate` da una immagine con tre env file. Riscrittura tracciata in NAS-102.

**Obiettivo:** un solo host Docker con app, Postgres e job; nessun servizio pubblicato; storage e backup fuori dalla VPS.

## Componenti

| Componente | Scelta | Note |
| --- | --- | --- |
| Runtime | Node 24 LTS | TanStack Start + Hono in un processo |
| ORM / migrazioni | Drizzle | SQL versionato nel repository |
| Database | Postgres 17 + pgvector | container, volume dedicato, niente porta pubblica |
| Job | pg-boss | schema `pgboss` nello stesso Postgres; niente Redis obbligatorio |
| Storage | Cloudflare R2 (S3) | allegati e backup; MinIO solo se vuoi indipendenza totale |
| Email | Resend | record DNS già presenti; API key in `.env` |
| AI | provider esterni | OpenCode Go, OpenAI, Anthropic; nessun modello locale |
| Auth fase 1 | Cloudflare Access | cancello al bordo, nessun codice |
| Auth fase 2 | Better Auth | `userId`, sessioni, passkey; Postgres |
| Deploy | Docker Compose | GitHub Actions costruisce e deploya |
| UI opzionale | Dokploy | comodità, non sorgente di verità |

## Porte

| Servizio | Porta | Esposizione |
| --- | --- | --- |
| App produzione | 3001 | `127.0.0.1` |
| App staging | 3002 | `127.0.0.1` |
| Dokploy | 3000 | `127.0.0.1` |
| Postgres | 5432 | solo rete Docker |
| cloudflared | — | outbound |
| Traefik (se Dokploy) | 80/443 | `127.0.0.1` o bloccato |

Nessuna porta applicativa su `0.0.0.0`.

## Layout dei file

| Percorso nel repository | Percorso live | Contenuto |
| --- | --- | --- |
| `deploy/docker-compose.yml` | `/srv/nando/compose/docker-compose.yml` | Postgres 17 + pgvector (poi app e staging) |
| `deploy/dokploy/docker-compose.yml` | `/srv/nando/dokploy/docker-compose.yml` | Dokploy senza Swarm/Traefik |
| `docs/vps/scripts/` | `/usr/local/sbin/nando-*` | script operativi |
| — | `/srv/nando/compose/.env` | interpolazione Compose (600) |
| — | `/srv/nando/secrets/` | segreti applicativi e restic (700) |

Il repository è la sorgente di verità: le copie live si aggiornano da lì, mai il contrario.

## Compose — Postgres

`/srv/nando/compose/docker-compose.yml`:

```yaml
services:
  db:
    image: pgvector/pgvector:pg17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--data-checksums"
    command: >
      postgres
      -c shared_buffers=4GB
      -c effective_cache_size=12GB
      -c work_mem=32MB
      -c maintenance_work_mem=1GB
      -c max_connections=100
      -c wal_compression=on
      -c checkpoint_timeout=15min
      -c max_wal_size=4GB
      -c log_min_duration_statement=500
      -c shared_preload_libraries=pg_stat_statements
    volumes:
      - nando_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  nando_pgdata:
```

Note:

- `pgvector/pgvector:pg17` include l'estensione `vector`; abilitala con una migrazione (`CREATE EXTENSION IF NOT EXISTS vector;`). Abilita anche `pg_stat_statements` (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`).
- `shared_buffers=4GB` e `effective_cache_size=12GB` sono ragionevoli su 24 GB; misura con `pg_stat_statements` prima di alzare.
- Non pubblicare `5432`. L'app usa il nome servizio `db` nella rete Compose.
- Il volume è `nando_pgdata`; il backup logico è `pg_dump`, non il volume.

## Compose — app produzione

```yaml
services:
  app:
    image: ghcr.io/cgiovanni96/nando:${IMAGE_TAG:?IMAGE_TAG required}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - /srv/nando/secrets/app.env
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    ports:
      - "127.0.0.1:3001:3001"
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp
```

- L'immagine deve girare come utente non-root (`USER node`).
- `cap_drop: ALL` va bene per Node; se l'app usa `ping` o binding privilegiati, aggiungi solo il necessario.
- `healthcheck` usa `fetch` di Node, così non serve `curl` nell'immagine.
- `start_period` evita falsi negativi al boot.
- Se la password Postgres contiene caratteri speciali (`@`, `:`, `$`), non metterla in `DATABASE_URL`: usa `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` oppure URL-encode. In alternativa genera una password alfanumerica.

## Compose — staging

Stesso file con override `docker-compose.staging.yml`:

- progetto Compose `nando-staging`;
- container `nando-staging-app`;
- porta `127.0.0.1:3002:3001`;
- database `nando_staging`;
- volume `nando_staging_pgdata`;
- env `/srv/nando/secrets/app.staging.env`;
- Access separato su `nando-staging.giovannicosta.me`.

Non condividere mai database, volume o `.env` tra staging e produzione.

## Migrazioni

- `drizzle-kit generate` produce SQL nel repository; il SQL viene committato.
- Il deploy esegue le migrazioni **prima** di avviare la nuova app, con un container one-shot:

```bash
cd /srv/nando/compose
sudo docker compose run --rm app pnpm db:migrate
```

- Prima di ogni migrazione in produzione: `nando-backup` (o almeno `pg_dump`).
- Regola expand/contract: aggiungi colonne/tabelle, deploya, migra i dati, rimuovi il vecchio in un deploy successivo. Niente `DROP` improvvisi.
- Le migrazioni sono forward-only. Il rollback è "immagine precedente + migrazione compatibile", non down-migration.
- Testa sempre su staging.

## pg-boss

- Usa lo stesso Postgres, schema `pgboss`.
- Avvia il worker nello stesso processo dell'app o in un container `worker` separato. Per un single-user, lo stesso processo è più semplice; se i job sono pesanti, separa.
- I job devono essere idempotenti: il broker è at-least-once.
- Configura `retryLimit`, `retryDelay`, `expireIn` e una dead-letter/archivio.
- Non usare `setTimeout` o cron in-process per job durevoli.

## Storage R2

Bucket:

- `nando-assets` — allegati, immagini, export importati.
- `nando-backups` — repository restic e dump.

Credenziali: token S3 con permessi limitati ai due bucket. Endpoint:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Env:

```text
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET_ASSETS=nando-assets
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

L'app usa l'SDK S3; non salvare byte nel database. R2 è S3-compatibile: se un giorno passi a MinIO/S3, cambi endpoint e credenziali.

## Resend

- I record DNS sono già presenti (vedi `01-domain.md`); non rimuoverli.
- API key in `/srv/nando/secrets/app.env`.
- Mittente: `nando@giovannicosta.me` o `no-reply@giovannicosta.me`.
- DMARC `p=none`; valuta `quarantine` dopo qualche settimana di invii legittimi.
- Se in futuro serve ricevere email, aggiungi Cloudflare Email Routing o un provider MX; non è v1.

## AI provider

- Solo provider esterni: OpenCode Go, OpenAI, Anthropic.
- La VPS ha bisogno solo di HTTPS in uscita; nessuna GPU, nessun Ollama.
- Chiavi in `.env`, mai nel repository.
- Il modello è scelto dall'utente (ADR-0008); niente fallback automatico.
- Log solo metadata (provider, modello, token, latenza, esito); mai prompt o contenuti.
- Se un provider è irraggiungibile, l'app fallisce il turno con un errore chiaro; non passa silenziosamente a un altro modello.

## Auth

**Fase 1 — Cloudflare Access.** Tutte le hostname sono protette da Access. L'app può assumere un unico proprietario; non serve login applicativo.

**Fase 2 — Better Auth.** Quando servono `userId`, sessioni revocabili, passkey o client esterni:

- adapter Drizzle su Postgres;
- `disableSignUp: true`, utente seminato;
- `trustedOrigins: ["https://nando.giovannicosta.me"]`;
- cookie host-only, `Secure`, `SameSite=Lax`;
- passkey RP ID = `nando.giovannicosta.me` (decidi prima di registrare);
- Access resta davanti come defense in depth.

## Dokploy

Stato attuale: installato **in Compose, senza Swarm e senza Traefik**. Dashboard su `127.0.0.1:3000`, raggiungibile solo via Tunnel + Access.

- File: `deploy/dokploy/docker-compose.yml` nel repository, copia live `/srv/nando/dokploy/docker-compose.yml`.
- Postgres dedicato (`dokploy-postgres`, postgres:16, volume `dokploy_pgdata`), separato da quello di Nando: un guasto o un upgrade dell'uno non trascina l'altro.
- Segreti in `/srv/nando/secrets/dokploy_postgres_password` e `dokploy_auth_secret` (600), montati come file.
- Nessuna porta pubblica: `ports: ["127.0.0.1:3000:3000"]`. Verifica con `ss -tlnp`.

Regole:

- **Compose nel repository** è la sorgente di verità; Dokploy è un'interfaccia, non l'unico posto dove vive la configurazione.
- La dashboard è protetta da Cloudflare Access (`admin.giovannicosta.me`). Dokploy monta `/var/run/docker.sock`, quindi vale root: non esporla mai senza Access.
- Se userai la funzione "Domains" di Dokploy, sappi che tenta di ricreare Traefik su 80/443. Con il Tunnel non serve: punta il tunnel direttamente alle porte app (`3001`, `3002`).
- Backuppa `/etc/dokploy` e il suo database; senza, perdi la configurazione.

## `.env` — solo nomi

Ci sono due file distinti:

- `/srv/nando/compose/.env` — interpolazione Compose (`POSTGRES_*`, `IMAGE_TAG`).
- `/srv/nando/secrets/app.env` — segreti applicativi, letto dall'app.

Entrambi con permessi `600`; nessuno dei due va nel repository.

`/srv/nando/compose/.env`:

```text
POSTGRES_DB=nando
POSTGRES_USER=nando
POSTGRES_PASSWORD=
IMAGE_TAG=
```

`/srv/nando/secrets/app.env`:

```text
NODE_ENV=production
PORT=3001
DATABASE_URL=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://nando.giovannicosta.me

RESEND_API_KEY=
EMAIL_FROM=nando@giovannicosta.me

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENCODE_GO_API_KEY=
AI_DEFAULT_PROVIDER=
AI_DEFAULT_MODEL=

S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET_ASSETS=nando-assets
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

LOG_LEVEL=info
```

I valori reali non entrano mai in Git, chat o log.

## Verifica

```bash
cd /srv/nando/compose

sudo docker compose ps
sudo docker compose logs --tail=100 app
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3002/api/health

sudo docker compose exec -T db pg_isready -U nando -d nando
sudo docker compose exec -T db psql -U nando -d nando -c '\dx'
```

`\dx` deve mostrare `vector`, `pg_stat_statements` e `pgcrypto` (se usato). Se manca `vector`, la migrazione non è stata applicata.
