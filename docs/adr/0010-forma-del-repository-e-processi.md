# 0010 — Forma del repository, processi e confini dei moduli

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-51 — Stack, repo e deployment
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

L'ADR-0009 ha spostato l'hosting da Cloudflare Workers a VPS-first e ha lasciato aperta la forma del repository: "monorepo lite" senza dire quanti pacchetti, dove vivono i moduli di dominio e chi può parlare con il database. Nel frattempo l'ADR-0003 ha fissato porte, eventi e idempotenza fra moduli, e l'ADR-0005 ha fissato la regola core/capability. Finché la struttura non è decisa, quei due invarianti restano convenzioni che nessuno strumento difende.

Il repository oggi contiene solo `docs/`, `deploy/` e una CI di ricognizione: nessun `package.json`, nessuna app. Ogni scelta futura pagherebbe il debito di una struttura improvvisata, e la prima riga di codice è il momento in cui i confini si possono ancora imporre gratis.

Un'applicazione a un solo processo non reggerebbe la separazione voluta: `web` è l'unico processo raggiungibile dal bordo, `api` possiede dominio e database, `worker` esegue i job differiti. Tenere `web` lontano dal database è ciò che dà a `api` un unico punto in cui applicare idempotenza, dedup e rettifiche: due percorsi di scrittura sarebbero due verità.

## Decisione

### Workspace

- **pnpm workspaces**, nessun altro orchestratore. Otto workspace:
  - `apps/web` — TanStack Start, SSR e server function, composition root del processo esposto;
  - `apps/api` — Hono, dominio, composition root del processo con accesso ai dati;
  - `apps/worker` — pg-boss, composition root dei job;
  - `packages/kernel` — id, `EntityRef`, `PropertyValue` e lifecycle policy, clock, `Result`;
  - `packages/core` — Space/PARA, Task, Calendar come vista, Notification, Person minima;
  - `packages/platform` — database e journal Drizzle, job, storage S3, email, AI gateway;
  - `packages/capability-knowledge`, `packages/capability-habits` — le capability della v1.
- **Niente Turborepo in v1.** Sette pacchetti, una immagine da buildare e `pnpm -r` bastano; Turbo si innesta dopo senza riscrivere nulla perché legge gli stessi script.
- **Lint e format: oxlint + Prettier.** I confini architetturali non sono una regola di lint: li impone il grafo dei workspace.
- **Contratto degli script, identico in locale e in CI:** `pnpm typecheck`, `lint`, `test`, `build`, `db:migrate`.

### Processi

- **Tre processi e un one-shot**, da una sola immagine con quattro comandi: `start:web`, `start:api`, `start:worker`, `start:migrate`.
- `web` ascolta su `3001` in produzione e `3002` in staging, pubblicato solo su `127.0.0.1`.
- `api` e `worker` non pubblicano alcuna porta sull'host: esistono solo sulla rete del progetto Compose.
- **Health:** `api` espone `/api/health` come readiness e verifica il database; `web` espone `/healthz` come liveness e non interroga il database, per non propagare un guasto del DB come guasto del processo. `worker` non ha healthcheck HTTP: la sua liveness è il processo e il monitoraggio dei job pg-boss.
- **Rollback:** `IMAGE_TAG=<precedente> docker compose up -d` ricrea i tre processi. Il servizio `migrate` viene rieseguito con l'immagine precedente e non applica nulla, perché il journal è già avanzato: le migrazioni restano forward-only.

### Accesso ai dati

- **Solo `api` tocca il database.** `web` non ha `DATABASE_URL`, non importa Drizzle e non conosce lo schema.
- `web` chiama l'API con il client RPC tipizzato di Hono (`hc<AppType>`): nessun codegen, nessun contratto da mantenere a mano, errori di tipo in compilazione quando una route cambia.
- Ogni processo ha **un solo composition root** che costruisce i moduli e inietta le dipendenze; non esiste un composition root condiviso fra processi.

### Confini dei moduli

- Ogni modulo esporta `create<X>Module(deps)` e restituisce `{ commands, queries, ports }`. `deps` sono interfacce strette (`clock`, `ids`, `db`, `notifier`, `storage`, `aiGateway`); niente decoratori, niente reflection, niente container DI.
- **Lo schema Drizzle vive nel pacchetto che possiede le tabelle.** `packages/platform` li ri-esporta solo per generare un journal di migrazioni unico.
- Il vincolo core/capability è nel grafo: `packages/core` non ha una dipendenza verso `packages/capability-*`, e le capability non dipendono l'una dall'altra. Un import vietato non compila, non serve una regola di lint.

### Ingresso

- **Produzione:** Cloudflare Tunnel + Access davanti al solo `web`. L'API non ha route sul tunnel e non è raggiungibile dall'esterno.
- **Staging:** nessuna route pubblica. `tailscale serve --bg` pubblica `127.0.0.1:3002` come `https://<host>.<tailnet>.ts.net`, raggiungibile da laptop e telefono, con certificato valido. Il vecchio hostname `nando-staging.giovannicosta.me`, la sua route e la sua app Access vanno rimossi (superato dall'emendamento 2026-11-11 qui sotto).
- **Fiducia `web` → `api`:** bearer token interno letto da un file di segreti, confronto constant-time, mai nei log. L'API non valida il JWT di Access: non è raggiungibile dal bordo, quindi non c'è nessun token da validare.
- **Streaming:** `web` espone `/events` e inoltra lo stream SSE prodotto da `api`. Compressione e buffering disattivati su quella route. Un solo origin per il browser, sia per le notifiche in-app sia per lo streaming delle risposte AI.
- Il codice non assume mai Access: staging gira senza, quindi nessun header `CF-Access-*` è una fonte di identità.

### Segreti

- **Tre file, minimo privilegio:** `web.env` (`API_URL`, `INTERNAL_TOKEN`), `api.env` (`DATABASE_URL`, `INTERNAL_TOKEN`, chiavi AI, Resend, R2), `worker.env` (`DATABASE_URL`, Resend, R2). Il servizio `migrate` usa `api.env`.
- Produzione: file in `/srv/nando/secrets/`, permessi `600`. Staging: variabili nell'editor di Dokploy, quindi la configurazione di Dokploy entra nel backup.

### Deploy e ambienti

- **Migrazioni come servizio one-shot** nel compose: `migrate` con `restart: "no"`, e `web`/`api`/`worker` con `depends_on: service_completed_successfully`. Se `migrate` fallisce nessun processo nuovo parte. Vale identico per il wrapper di produzione e per Dokploy in staging: nessun hook proprietario, nessun passo da ricordare.
- **Staging è posseduto da Dokploy** come applicazione Compose: deploy via API dal workflow con il tag immutabile nell'ambiente, start/stop dal pannello. `nando-deploy staging start|stop` diventa un client di poche righe sull'API di Dokploy: UI e CLI sono lo stesso piano di controllo, non due proprietari.
- **Produzione resta al wrapper + Compose:** backup prima dell'`up`, smoke con rollback, log in `/var/log/nando/deploy.log`.
- **Staging a pieno parity:** `web`, `api`, `worker`, `migrate` e un Postgres proprio, con worker a `concurrency: 1`. Diverso da produzione solo per database, volumi, porte, segreti e assenza di Access.
- **Sviluppo locale:** `pnpm dev` avvia `web`, `api` e `worker` in watch (`pnpm -r --parallel dev`) con Postgres da `deploy/compose.dev.yml`; il compose completo serve alle prove di parity, non alla giornata di lavoro. Build locale → database locale: mai un build locale puntato al database di staging.

## Schema concettuale

```text
Repository
  apps/web        TanStack Start  ── RPC tipizzato ──▶ apps/api (Hono)
  apps/api        dominio, Drizzle, sessione
  apps/worker     pg-boss
  packages/kernel        id, EntityRef, PropertyValue, clock
  packages/core          Space, Task, Calendar, Notification, Person
  packages/platform      db + journal, job, storage, email, AI gateway
  packages/capability-*  Knowledge, Habits

Produzione
  Cloudflare (TLS, Access)
    └─ Tunnel ─▶ 127.0.0.1:3001  web ─┐
                                       ├─ rete Docker ─▶ api (3000) ─▶ Postgres
                                       └─ rete Docker ─▶ worker ─────▶ Postgres

Staging (tailnet)
  tailscale serve ─▶ 127.0.0.1:3002  web ─▶ api ─▶ Postgres staging
  Dokploy: deploy, start, stop

Deploy
  migrate (one-shot) ─▶ web, api, worker
```

## Invarianti

1. Una sola immagine, quattro comandi; nessun processo ha un'immagine propria.
2. `web` non conosce il database, né in codice né in configurazione.
3. `api` è l'unico punto di scrittura e di applicazione delle invarianti di dominio.
4. `packages/core` non dipende da una capability; le capability non dipendono l'una dall'altra.
5. Ogni processo ha un solo composition root.
6. Nessuna porta pubblica: produzione solo via Tunnel, staging solo via tailnet.
7. `api` e `worker` non sono raggiungibili dall'esterno in nessun ambiente.
8. Le migrazioni girano una volta, prima dei processi, e sono forward-only.
9. Un solo proprietario per stack Compose: Dokploy per staging, wrapper per produzione.
10. Il codice non dipende da Access: nessun header `CF-Access-*` autentica una richiesta.
11. Segreti al minimo privilegio: `web` non tiene credenziali di database né chiavi AI.
12. Il contratto degli script è lo stesso in locale, in CI e nei container.

## Conseguenze

- **ADR-0009:** la decisione VPS-first resta valida; cambia la topologia dei processi e il percorso di deploy di staging.
- **ADR-0003:** le porte fra moduli hanno ora un posto fisico, `packages/*`; `EntityRef` vive in `kernel`.
- **ADR-0005:** il confine core/capability è imposto dal grafo dei workspace, non dalla disciplina.
- **ADR-0006/0008:** le notifiche e lo streaming AI passano dallo stesso relay SSE di `web`.
- **NAS-47:** la persistenza eredita un solo scrittore e un journal unico; il backup pre-deploy resta obbligatorio.
- **NAS-53:** la roadmap parte da otto workspace e da un deploy a tre servizi, non da una singola app.
- **docs/vps:** `README`, `03-stack` e `04-delivery` descrivono ancora un container `app`, un solo `app.env`, staging dietro Access e `nando-deploy staging`; sono superati da questo ADR e vanno riscritti.
- **Operazioni:** staging acceso e spento a mano introduce una causa di guasto in più (staging spento = smoke di staging non eseguibile); il wrapper deve dichiararlo invece di fallire in modo opaco.

## Alternative scartate

- **App singola con cartelle interne:** confine core/capability affidato alla disciplina, nessun errore di compilazione su un import sbagliato.
- **Un pacchetto per modulo di dominio:** isolamento massimo, frizione di build e versioning sproporzionata a un single-user.
- **Tre immagini Docker:** build e cache triplicate senza isolamento reale, perché il codice è lo stesso.
- **Un solo processo per web e api:** annulla la separazione voluta e rimette il database nello stesso processo che risponde a internet.
- **`web` legge il database in SSR:** due composition root con potere di dominio e due modi di leggere lo stesso schema.
- **API esposta al bordo (path routing o secondo hostname):** ogni route dovrebbe reggere da sola Access e validazione, e il browser perderebbe il single-origin.
- **Access anche su staging:** due policy da mantenere allineate per un ambiente che non usa nessun altro, e un hostname pubblico in più.
- **mTLS fra container:** identità crittografica forte per una PKI interna che nessuno vuole ruotare.
- **Migrazioni all'avvio dell'app:** race fra processi, deploy non atomico, rollback ambiguo.
- **Dokploy proprietario anche della produzione:** perde backup-prima-della-migrazione, smoke con rollback e ordine di deploy che oggi vivono nel wrapper.
- **Due proprietari sullo stesso progetto Compose:** drift silenzioso fra due sorgenti di verità.
- **Turborepo subito:** un file e un modello mentale in più per una cache che serve quando la CI supera i minuti, non prima.
- **ESLint + Prettier:** ecosistema più ricco, ma i confini non sono una regola di lint e due tool costano più di uno.

## Emendamento 2026-11-11 — staging raggiungibile anche tramite Access

**Stato:** accettato. Supera l'ultima frase di *Ingresso → Staging* e l'alternativa scartata *Access anche su staging*.

Il tailnet resta il percorso canonico dello staging, ma non è più l'unico: `nando-staging.giovannicosta.me` resta attivo dietro Cloudflare Access con la policy `allow-owner`, come seconda porta d'ingresso per i dispositivi che non hanno Tailscale attivo. La route del Tunnel resta su `127.0.0.1:3002`; non si aggiungono route verso `api`.

Conseguenze:

- L'invariante 10 non cambia: Access è solo al bordo, nessun header `CF-Access-*` autentica una richiesta, e il codice non assume che staging giri senza Access.
- Lo smoke di `deploy-staging` continua a girare sul tailnet: l'hostname pubblico è una comodità, non una dipendenza del deploy.
- La superficie pubblica cresce di un hostname. Route, app Access e policy vanno trattate come parte dell'ambiente: se Access viene rimossa o riconfigurata, lo staging diventa raggiungibile da internet.
- Resta un secondo ingresso allo stesso `web`, non un canale verso `api`: il contratto `web`↔`api` (ADR-0022) non cambia.
