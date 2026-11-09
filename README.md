# Nando

Personal OS single-user: Space che compongono capability sopra un core sempre presente.

Il repository è nella fase **M0 — Fondazione deployabile**. Non esistono ancora flussi utente: le fette di M0 costruiscono repo, CI, database, contratto HTTP, shell vuota e deploy.

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

## Setup

```bash
pnpm install
cp .env.example .env
```

## Database locale

```bash
docker compose -f deploy/compose.dev.yml up -d --wait
pnpm db:migrate
pnpm db:seed
```

`db:seed` inserisce l'utente owner con l'ID in `OWNER_USER_ID`. API e worker non partono se l'owner non esiste.

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
| `pnpm db:seed` | Semina l'owner da `OWNER_USER_ID` |
| `pnpm db:check` | Drift fra schema Drizzle e migrazioni |
| `pnpm start:migrate` | Migrate + seed, come nel container `migrate` |
| `pnpm docs:check` | Allineamento route/OpenAPI (NAS-131) |
| `pnpm verify` | Catena dei gate disponibili |

`pnpm verify` include tutti i gate di M0 solo quando le fette che li possiedono sono atterrate.

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

Lo staging vive su Dokploy e sul tailnet, senza route pubbliche. La procedura completa è in [`docs/vps/staging-m0.md`](docs/vps/staging-m0.md).

```bash
gh workflow run deploy-staging -f image_tag=sha-<full-sha>
```

Il workflow aggiorna `IMAGE_TAG` nel compose Dokploy, deploya e fa smoke su `/healthz`, OpenAPI e `/api/system/info`.

## Documenti

- `AGENTS.md` — contratto operativo per gli agenti
- `GLOSSARY.md` — vocabolario di dominio
- `docs/adr/` — decisioni architetturali
- `docs/agents/` — checklist operative
- `docs/vps/` — hosting e operazioni
