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

- Utente non-root, con shell necessaria al runner (`/bin/bash`), chiave SSH dedicata.
- Non aggiungerlo al gruppo `sudo`; usa un drop-in con i soli comandi di deploy.
- Con GitHub-hosted runner l'IP è dinamico: usa **Tailscale ephemeral** nel workflow (`tailscale/github-action`) e `from="100.64.0.0/10"`, oppure Cloudflare Access. Non puoi allowlistare l'IP del runner.

```bash
sudo adduser --disabled-password --gecos "" nando-deploy
sudo install -d -m 700 -o nando-deploy -g nando-deploy /home/nando-deploy/.ssh
# incolla la chiave pubblica del runner in authorized_keys

sudo tee /etc/sudoers.d/nando-deploy >/dev/null <<'EOF'
nando-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose *
nando-deploy ALL=(root) NOPASSWD: /usr/local/sbin/nando-backup
EOF
sudo chmod 440 /etc/sudoers.d/nando-deploy
sudo visudo -c
```

`docker compose *` è potente: se vuoi ridurre la superficie, incapsula pull/migrate/up/health in uno script `/usr/local/sbin/nando-deploy` e concedi solo quello.

- Non dare a `nando-deploy` accesso a `.env` in chiaro: i comandi Compose lo leggono come root.
- Revoca la chiave quando il runner cambia.

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
