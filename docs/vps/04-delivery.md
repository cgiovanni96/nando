# 04 — Build, deploy e migrazioni

**Obiettivo:** ogni modifica arriva in produzione solo dopo test, build immutabile, migrazione verificata e smoke test. Il deploy non dipende da click-ops.

## Modello di branch e ambienti

| Evento | Ambiente | Automazione |
| --- | --- | --- |
| Pull request | — | typecheck, lint, test, build |
| Push su `main` | staging | build + push GHCR + deploy staging + smoke |
| Workflow manuale / tag | produzione | approvazione + deploy + smoke |
| Hotfix | produzione | branch `hotfix/*`, PR, stesso percorso |

Produzione non parte da un push diretto: serve un'approvazione esplicita (GitHub Environment `production`).

## Immagini

- Registry: **GHCR** (`ghcr.io/cgiovanni96/nando`).
- Tag: `sha-<short>` per ogni commit, `staging` per l'ultimo staging, `production` per l'ultimo produzione.
- Mai deployare `latest` in produzione: il tag deve essere immutabile e rintracciabile.
- L'immagine è multi-stage e gira come utente non-root.

Esempio di build:

```yaml
name: build
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
  packages: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

Push dell'immagine (solo su `main` o tag):

```yaml
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/cgiovanni96/nando:sha-${{ github.sha }}
            ghcr.io/cgiovanni96/nando:staging
```

## Deploy staging

1. Build e push dell'immagine.
2. SSH sulla VPS come `nando-deploy` (chiave dedicata).
3. Backup leggero o snapshot logico.
4. Migrazioni su `nando_staging`.
5. `docker compose up -d`.
6. Smoke test.
7. Se fallisce, rollback all'immagine precedente.

> Percorso canonico: `sudo nando-deploy staging sha-<short>` esegue i passi 4–7 e fa il rollback da solo. I comandi espliciti sotto restano utili per capire cosa fa e per il debug.

Comandi sul host:

```bash
cd /srv/nando/compose
export IMAGE_TAG=sha-<short>

sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml pull app
sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm app pnpm db:migrate
sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d app

curl -fsS http://127.0.0.1:3002/api/health
```

## Deploy produzione

Produzione è un workflow manuale con approvazione. Ordine obbligatorio:

> Percorso canonico: `sudo nando-deploy production sha-<short>` — il backup è dentro il wrapper e blocca il deploy se fallisce.

```bash
cd /srv/nando/compose
export IMAGE_TAG=sha-<short>

# 1. backup prima della migrazione
sudo /usr/local/sbin/nando-backup

# 2. migrazioni
sudo docker compose run --rm app pnpm db:migrate

# 3. nuova app
sudo docker compose up -d app

# 4. smoke
curl -fsS http://127.0.0.1:3001/api/health
sudo docker compose logs --tail=100 app
```

Se lo smoke fallisce:

```bash
export IMAGE_TAG=sha-<previous>
sudo docker compose up -d app
```

Se la migrazione è incompatibile con l'immagine precedente, l'unico rollback sicuro è ripristinare il dump pre-deploy su un database nuovo e ripuntare l'app. Per questo il backup è obbligatorio prima della migrazione.

## Migrazioni

- SQL generato da Drizzle e committato.
- Sempre prima staging, poi produzione.
- Sempre backup prima della produzione.
- Forward-only: niente down-migration in produzione.
- Expand/contract per i cambi Breaking:
  1. aggiungi colonna/tabella nullable;
  2. deploya il codice che scrive entrambe;
  3. migra i dati;
  4. rimuovi il vecchio in un deploy successivo.
- Vietato in produzione senza piano: `DROP TABLE`, `DROP COLUMN`, `ALTER TYPE` distruttivo, `TRUNCATE`, rinomina di colonne usate.
- Le migrazioni girano in un container one-shot, non all'avvio dell'app: evita race e rende il deploy esplicito.

## Smoke test

Minimo:

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3002/api/health
sudo docker compose ps
sudo docker compose logs --since=5m app | grep -Ei 'error|fatal|exception' || true
```

`/api/health` deve controllare anche il database (`SELECT 1`) e restituire `200` solo se l'app è pronta. Non deve esporre dettagli sensibili.

## GitHub Environments e segreti

- `staging`: nessuna approvazione; deploy automatico da `main`.
- `production`: approvazione manuale obbligatoria; solo il proprietario può approvare.
- Segreti GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`.
- I segreti applicativi (DB, AI, Resend, R2) restano sulla VPS, non su GitHub.
- La chiave SSH di deploy è dedicata (`nando-deploy`) e ha permessi limitati; non è la chiave dell'agente di manutenzione.
- Pinna le action per SHA in produzione, se vuoi ridurre la supply-chain surface.

Esempio di deploy via SSH:

```yaml
name: deploy-staging
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /srv/nando/compose
            export IMAGE_TAG=sha-${{ github.sha }}
            sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml pull app
            sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm app pnpm db:migrate
            sudo docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d app
            curl -fsS http://127.0.0.1:3002/api/health
```

## Utente `nando-deploy`

- Utente non-root, non nel gruppo `sudo`, chiave SSH dedicata.
- **Non ha `sudo docker compose`**: ha `NOPASSWD` solo su `/usr/local/sbin/nando-deploy`, un wrapper che implementa l'ordine di deploy. `docker compose` arbitrario è root mascherato: con quel permesso il "deploy user" può avviare un container con `/` montato.

Installazione (script nel repository, idempotente):

```bash
# dal repository, dopo aver copiato scripts/ e la chiave pubblica del runner
sudo bash docs/vps/scripts/setup-nando-deploy.sh
```

Lo script crea `nando-deploy`, installa `/usr/local/sbin/nando-deploy` (750 root), scrive `/etc/sudoers.d/nando-deploy`, e limita la chiave al range Tailscale con `from="100.64.0.0/10"`.

Wrapper:

```bash
sudo nando-deploy production sha-a1b2c3d   # backup -> pull -> migrate -> up -> smoke
sudo nando-deploy staging    sha-a1b2c3d
sudo nando-deploy status production        # sola lettura: tag, container, health
```

Comportamento:

- Il tag si passa via `IMAGE_TAG` nell'ambiente: **non** riscrive `.env`, quindi non lascia stato sporco.
- In produzione esegue `nando-backup` **prima** di toccare l'app; se il backup fallisce, il deploy non parte.
- Le migrazioni girano in un container one-shot: se falliscono, l'app corrente resta in piedi.
- Se lo smoke test non passa entro 60 s, torna al tag precedente e lo dichiara nel log.
- Ogni passo finisce in `/var/log/nando/deploy.log`.

### Ingresso del runner

Il runner GitHub è ospitato e ha IP dinamico: niente allowlist. Entra nel tailnet come nodo **effimero taggato `tag:ci`**, e la chiave di `nando-deploy` accetta solo `100.64.0.0/10`.

ACL Tailscale (una tantum, admin console → **Access controls** → editor JSON, `https://login.tailscale.com/admin/acls/file`):

```json
{
  "tagOwners": { "tag:ci": ["autogroup:admin"] }
}
```

> **Solo `tagOwners`, nessun blocco `acls`.** Con la policy di default tutti i nodi si raggiungono: aggiungere un array `acls` non vuoto nega tutto il resto e ci si chiude fuori dalla VPS. Se in futuro si passa a una policy esplicita, la regola per il runner va aggiunta **insieme** a quelle dei dispositivi umani, mai da sola:
>
> ```json
> { "action": "accept", "src": ["tag:ci"], "dst": ["100.99.66.53:22"] }
> ```
>
> Le due serrature indipendenti restano la chiave con `from="100.64.0.0/10"` e il sudo limitato al wrapper.

Il tag deve esistere in `tagOwners` **prima** di creare l'OAuth client, altrimenti non compare tra i tag selezionabili.

L'OAuth client per il runner si crea in *Settings → Trust credentials → OAuth clients*, con scope `Devices: Core` (write) e `Auth keys` (write) e il tag `tag:ci`; client id e secret vanno nei secret GitHub `TS_OAUTH_CLIENT_ID` e `TS_OAUTH_SECRET`. Nel workflow: `tailscale/github-action` con `oauth-client-id` e `oauth-secret`, poi `ssh` verso `100.99.66.53`.


## Rollback e immagini

- Mantieni le ultime 5 immagini: `docker image prune` solo dopo aver verificato i tag in uso.
- Il rollback è `IMAGE_TAG=<precedente> docker compose up -d app`.
- Non cancellare i volumi per "ripartire pulito": perdi il database.
- Dopo un rollback, annota l'evento in `maintenance-log.md`.

## Checklist deploy

- [ ] CI verde su PR
- [ ] Migrazione testata su staging
- [ ] Backup pre-deploy in produzione
- [ ] Immagine con tag `sha-*`
- [ ] Migrazione eseguita una volta sola
- [ ] App healthy su `127.0.0.1:3001`
- [ ] Log senza errori
- [ ] Access raggiungibile dall'esterno
- [ ] Rollback pronto (tag precedente)
- [ ] Eventuale evento annotato nel log
