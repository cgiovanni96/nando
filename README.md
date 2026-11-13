# Nando

Personal OS single-user: Space che compongono capability sopra un core sempre presente.

Il repository è nella fase **M1 — Cattura e collocazione**: Space, Inbox, Task e pagina entità minima. La demo e la settimana d'uso su staging sono in [`docs/staging/demo-m1.md`](docs/staging/demo-m1.md).

## Requisiti

- Node 24
- pnpm 11.7.0 (`corepack enable` oppure `npm install -g pnpm@11.7.0`)
- Docker, per i test di integrazione e il database locale

## Stack

- Node 24, pnpm 11.7, TypeScript 6.
- `web`: TanStack Start + Vite + Nitro (output `.output/server`).
- `api`: Hono, servito da `@hono/node-server`, bundlato con tsdown.
- `worker`: processo Node bundlato con tsdown.
- Database, migrazioni e Drizzle: NAS-133, con postgres.js.

## Avvio locale

Serve Docker con container Linux per il Postgres 17 + pgvector di sviluppo.

```bash
pnpm install
cp .env.example .env                          # PowerShell: Copy-Item .env.example .env
docker compose -f deploy/compose.dev.yml up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Apri `http://localhost:3001`.

- `web` ascolta su `3001`, `api` su `3000`, `worker` non ha porta.
- Il compose dev pubblica Postgres su `127.0.0.1:5433`, per non collidere con un PostgreSQL locale su `5432`.
- `db:seed` inserisce l'utente owner con l'ID in `OWNER_USER_ID` e lo Space iniziale «Vita». API e worker non partono se l'owner non esiste.
- Per vedere solo la shell senza database: `pnpm --filter @nando/web dev`.

`pnpm test:integration` usa `TEST_DATABASE_URL` se presente; altrimenti avvia `deploy/compose.dev.yml`, crea `nando_test` e applica le migrazioni. Se Docker o Postgres non sono disponibili fallisce con un messaggio azionabile: la suite non viene saltata in silenzio.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `pnpm dev` | web, api e worker in watch |
| `pnpm typecheck` | TypeScript su tutti i workspace |
| `pnpm lint` | oxlint + Prettier |
| `pnpm test` | Unit test, senza Docker |
| `pnpm test:integration` | Integration test con Postgres 17 + pgvector |
| `pnpm build` | Build di web, api e worker |
| `pnpm db:generate` | Genera una migrazione Drizzle |
| `pnpm db:migrate` | Applica le migrazioni |
| `pnpm db:seed` | Semina l'owner da `OWNER_USER_ID` e lo Space iniziale |
| `pnpm db:check` | Drift fra schema Drizzle e migrazioni |
| `pnpm start:migrate` | Migrate + seed, come nel container `migrate` |
| `pnpm docs:check` | Allineamento route/OpenAPI (NAS-131) |
| `pnpm verify` | Catena dei gate disponibili |

`pnpm verify` = `typecheck` + `lint` + `db:check` + `deploy:check` + `docs:check` + `test` + `test:integration` + `build`.

## Workspace

```text
apps/web                 TanStack Start, processo esposto
apps/api                 Hono, dominio e database
apps/worker              job differiti
packages/kernel          id, EntityRef, PropertyValue, clock, Result
packages/core            Space, Task, Calendar, Notification, Person
packages/platform        database, journal, job, storage, email, AI
packages/capability-*    Knowledge, Habits
```

Regole: `web` non tocca il database; `api` è l'unico scrittore; `packages/core` non dipende dalle capability; ogni processo ha un solo composition root.

## Deploy staging

Lo staging vive su Dokploy e sul tailnet, con l'hostname dietro Access come seconda porta. La procedura infrastrutturale di M0 è in [`docs/staging/demo-m0.md`](docs/staging/demo-m0.md); la verifica e la demo di M1 sono in [`docs/staging/demo-m1.md`](docs/staging/demo-m1.md).

```bash
gh workflow run deploy-staging -f image_tag=sha-<full-sha>
```

Il workflow aggiorna `IMAGE_TAG` nel compose Dokploy, deploya e fa smoke su `/healthz`, OpenAPI e `/api/system/info`.

## Documenti

- `AGENTS.md` — contratto operativo per gli agenti
- `GLOSSARY.md` — vocabolario di dominio
- `docs/adr/` — decisioni architetturali
- `docs/agents/` — checklist operative
- `docs/staging/` — demo e verifica delle milestone su staging
- `docs/vps/` — hosting e operazioni
