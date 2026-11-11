# Staging M0 — Dokploy e tailnet

Questa procedura porta lo staging di M0 su Dokploy, raggiungibile solo dal tailnet. Non apre route pubbliche e non tocca la produzione.

## Valori da produrre

| Valore | Dove nasce | Dove finisce |
| --- | --- | --- |
| `IMAGE_TAG` | workflow `ci` su `main` (`sha-<full sha>`) | env del compose Dokploy, aggiornato dal workflow |
| `POSTGRES_PASSWORD` | generata, solo alfanumerica/hex | env Dokploy |
| `OWNER_USER_ID` | UUIDv7 fisso | env Dokploy |
| `INTERNAL_TOKEN` | generata, 32 byte hex | env Dokploy; GitHub secret non serve |
| `DOKPLOY_URL` | `https://<vps>.<tailnet>.ts.net:8443` | GitHub secret `DOKPLOY_URL` (environment `staging`) |
| `DOKPLOY_API_KEY` | Dokploy → Settings → API Keys | GitHub secret `DOKPLOY_API_KEY` |
| `DOKPLOY_COMPOSE_ID` | URL dell'app Compose in Dokploy | GitHub secret `DOKPLOY_COMPOSE_ID` |
| `STAGING_URL` | `https://<vps>.<tailnet>.ts.net` | GitHub secret `STAGING_URL` |
| PAT GHCR | GitHub → Settings → Developer settings → Tokens (read:packages) | `docker login ghcr.io` sulla VPS |

Non incollare segreti in chat, issue o log.

## 1. Prerequisiti sulla VPS

- Docker e Dokploy attivi (`deploy/dokploy/docker-compose.yml`).
- Tailscale attivo e MagicDNS raggiungibile dal telefono e dal runner CI.
- Il runner CI entra nel tailnet come nodo effimero `tag:ci` (già usato da `ci-smoke.yml`).
- Accesso alla dashboard Dokploy: `https://admin.giovannicosta.me`.

Il package GHCR `ghcr.io/cgiovanni96/nando` è **pubblico**: Dokploy pulla l'immagine senza credenziali, quindi non serve `docker login` sulla VPS. Se in futuro il package torna privato, autentica GHCR e lascia le credenziali in `/root/.docker/config.json`, usato da Dokploy:

```bash
sudo docker login ghcr.io -u cgiovanni96
# incolla un PAT con scope read:packages
```

## 2. Tailscale serve

Sulla VPS, pubblica solo sul tailnet:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:3002
sudo tailscale serve --bg --https=8443 http://127.0.0.1:3000
sudo tailscale serve status
```

- `443` → `web` staging (`127.0.0.1:3002`).
- `8443` → dashboard/API Dokploy (`127.0.0.1:3000`), usata dal workflow di deploy.
- Il nome è quello della VPS nel tailnet: `https://<vps>.<tailnet>.ts.net`.
- Verifica che `ss -tlnp` mostri `3002` e `3000` solo su `127.0.0.1`.
- Nessuna route Cloudflare per staging.

## 3. App Compose in Dokploy

1. Apri `https://admin.giovannicosta.me`.
2. Crea il progetto `Nando` e l'ambiente `staging`.
3. Crea una **Compose** app `nando-staging`, sorgente **raw**, e incolla `deploy/compose.staging.yml`.

   Il corpo del compose è inviato dal repository a ogni deploy: l'incolla qui serve solo al bootstrap. Il workflow chiama `compose.update` con `composeFile` preso da `deploy/compose.staging.yml` e poi rilegge il salvato: se il corpo salvato non è identico al file (a meno di BOM, CRLF e spazi finali), il deploy si ferma prima di toccare i container. Modificare il compose dalla UI di Dokploy è inutile, perché il deploy successivo lo sovrascrive: la modifica va fatta nel repository. `pnpm deploy:check` verifica che `api`, `web`, `worker` e `migrate` esistano e dichiarino il proprio `command`: l'immagine ha un solo `CMD` (web), quindi un servizio senza `command` esegue il server sbagliato.
4. Nell'ambiente dell'app imposta:

```dotenv
IMAGE_TAG=sha-bootstrap
POSTGRES_USER=nando
POSTGRES_DB=nando_staging
POSTGRES_PASSWORD=<hex>
OWNER_USER_ID=0199a4c2-7a10-7000-8000-000000000001
INTERNAL_TOKEN=<hex>
```

`POSTGRES_PASSWORD` e `INTERNAL_TOKEN` devono essere esadecimali: la password entra nella `DATABASE_URL`.

5. Copia il **Compose ID** dall'URL dell'app (o dalla risposta dell'API `compose.one`). È il valore per `DOKPLOY_COMPOSE_ID`.

Il primo deploy può fallire finché `IMAGE_TAG` non esiste in GHCR: il workflow lo aggiorna al primo deploy.

## 4. API key e GitHub secrets

In Dokploy: **Settings → API Keys → Create**, copia la chiave.

Nell'ambiente GitHub `staging`:

```bash
gh secret set DOKPLOY_URL --env staging --body "https://<vps>.<tailnet>.ts.net:8443"
gh secret set DOKPLOY_API_KEY --env staging
gh secret set DOKPLOY_COMPOSE_ID --env staging --body "<compose-id>"
gh secret set STAGING_URL --env staging --body "https://<vps>.<tailnet>.ts.net"
```

I secret `TS_OAUTH_CLIENT_ID` e `TS_OAUTH_SECRET` devono già esistere nello stesso environment; sono quelli di `ci-smoke.yml`.

## 5. Primo deploy

Il merge su `main` esegue `ci`: il job `build` pubblica:

- `ghcr.io/cgiovanni96/nando:sha-<full sha>`
- `ghcr.io/cgiovanni96/nando:staging`

Al termine, `deploy-staging` parte da `workflow_run` e:

1. legge `deploy/compose.staging.yml` dal commit deployato;
2. invia a Dokploy l'ambiente (`IMAGE_TAG` = `sha-<full sha>`) e il corpo del compose in un'unica `compose.update`;
3. rilegge il salvato: se il compose non è identico al file o `IMAGE_TAG` non è quello inviato, si ferma prima del deploy;
4. deploya;
5. fa smoke su `/healthz`, `/api/openapi.json`, `/api/system/info` e `/api/reference`.

Manuale:

```bash
gh workflow run ci
gh run watch
gh workflow run deploy-staging -f image_tag=sha-<full-sha>
gh run watch
```

## 6. Verifica

Dal telefono o dal laptop nel tailnet:

- `https://<vps>.<tailnet>.ts.net/` → shell vuota.
- `/healthz` → `{"status":"ok"}`.
- `/api/reference` → Scalar.
- `/api/openapi.json` → OpenAPI 3.1.
- `/api/system/info` → 200 con bearer aggiunto dal proxy.

Il worker non ha porta: la sua liveness è il processo e, più avanti, il monitoraggio pg-boss.

## 7. Rollback

Il rollback è un redeploy del tag precedente, non una down-migration:

```bash
gh workflow run deploy-staging -f image_tag=sha-<tag-precedente>
gh run watch
```

Il servizio `migrate` riesegue la catena forward-only: se il journal è già avanzato non applica nulla. Se la migrazione nuova non è compatibile con l'immagine precedente, il rollback sicuro è ripristinare il backup pre-deploy (procedura di ADR-0011), non improvvisare.

Il corpo del compose, invece, arriva sempre dal repository: un `workflow_dispatch` con un tag precedente riallinea anche `deploy/compose.staging.yml`. Se il rollback attraversa una modifica di compose incompatibile con l'immagine vecchia, prima fai revert di quel file su `main` e poi lancia il rollback.

## 8. Hostname pubblico

Decisione del 2026-11-11 (emendamento in [ADR-0010](../adr/0010-forma-del-repository-e-processi.md)): `nando-staging.giovannicosta.me` **resta attivo**, dietro Cloudflare Access con policy `allow-owner`, come seconda porta d'ingresso allo staging. La route del Tunnel resta su `127.0.0.1:3002` e non esistono route verso `api`.

Il percorso canonico rimane il tailnet (`https://<vps>.<tailnet>.ts.net`): lo smoke di `deploy-staging` usa quello. Se l'app Access o la policy vengono rimosse, lo staging diventa raggiungibile da internet: trattale come parte dell'ambiente, non come residuo.

## Troubleshooting

- **`migrate` fallisce:** controlla `DATABASE_URL`, `OWNER_USER_ID` e i log del servizio `migrate` in Dokploy.
- **`api` unhealthy:** il healthcheck esegue `SELECT 1`; controlla `db` e `DATABASE_URL`. Se i log di `api` sono vuoti o mostrano il server web, manca il `command`: `api` deve eseguire `node /app/api/index.mjs` e `worker` `node /app/worker/index.mjs`, altrimenti rispondono 404 su `/api/health`.
- **`web` unhealthy:** il healthcheck chiama `/healthz`; controlla `PORT=3002`.
- **401 dal proxy:** `INTERNAL_TOKEN` diverso fra `web` e `api`.
- **Pull GHCR negato:** rifai `docker login ghcr.io` sulla VPS o rendi pubblico il package.
- **Dokploy API 401:** API key errata o scaduta.
- **`composeFile` diverso dopo l'update:** la versione Dokploy installata non accetta il corpo del compose dall'API. Il deploy si ferma prima di toccare i container: aggiorna Dokploy e rilancia.
- **Tailscale serve non raggiungibile:** `tailscale serve status`, MagicDNS e ACL `tag:ci`.
