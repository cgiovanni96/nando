# 0021 — Strategia di test, CI e ambienti

- **Stato:** accettato
- **Data:** 2026-11-05
- **Ticket:** NAS-103 — Strategia di test, CI e ambienti
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0010, ADR-0011, ADR-0013

## Contesto

ADR-0010 ha fissato la forma del repository: pnpm workspaces, tre processi (`web`, `api`, `worker`) più `migrate`, un solo scrittore del database e il contratto degli script `pnpm typecheck`, `lint`, `test`, `build`, `db:migrate`. Ha anche fissato il deploy: migrazione one-shot, smoke con rollback, staging su Dokploy e produzione dietro Access.

Mancava cosa succede dentro quegli script. Il repository non ha ancora `package.json` né codice: la prima riga di codice è il momento in cui la strategia di test costa meno, perché non ci sono test da migrare né suite da riconciliare.

ADR-0013 ha aggiunto il criterio che rende il problema concreto: una capability è fatta solo se «esiste un test che lo prova e gira in CI». Senza una definizione di test, quel criterio è una promessa che ogni ticket può interpretare a modo suo. ADR-0011 ha aggiunto il restore mensile, che resta un'operazione e non un test di CI.

## Decisione

### Runner

- **Vitest** per unit e integration, con due projects separati.
- Un solo runner, la stessa configurazione Vite che usa `web`, e i projects permettono di eseguire le due suite con comandi e filtri diversi.
- Coverage con provider V8, prodotta come report advisory. Nessuna soglia.

### Cosa è un test

**Unit** — test di logica pura, senza I/O:

- `packages/kernel`, `packages/core`, `packages/capability-*`;
- funzioni di dominio, invarianti, calcoli di periodo, score, streak, forza, ricorrenze, rettifiche;
- dipendenze iniettate con clock e ID deterministici.

**Integration** — test con Postgres reale:

- `apps/api`: route group, repository, transazioni, idempotenza, deduplicazione, rettifiche, errori di dominio;
- `apps/worker`: handler dei job con dipendenze reali e un solo percorso pg-boss end-to-end;
- migrazioni applicate su un database vuoto.

**Fuori dai test in v1:**

- componenti Mantine, styling, layout e interazioni browser;
- SQL generato da Drizzle e librerie terze;
- performance, accessibilità automatica, visual regression;
- Cloudflare Access e l'ingresso dal bordo.

Le route di `web` non hanno test di rendering: il contratto è `hc<AppType>`, che fallisce in compilazione quando una route cambia. Ogni route group di `api` ha almeno un test integration che prova il comportamento a runtime.

### Dove vivono i test

- Unit **colocati** accanto al modulo: `*.test.ts`.
- Integration in `test/integration/**` nel workspace che possiede il codice.
- Nessun `packages/testing`: helper e fake vivono nel package che possiede la dipendenza (`packages/platform` per il database, `kernel` per clock e ID); le factory vivono accanto al modulo che le usa.
- I nomi dei test sono in inglese; un test per comportamento.
- I dati si costruiscono con factory esplicite (`aTask().inSpace(...).build()`), non con un seed globale condiviso. Ogni test crea solo ciò che gli serve.

### Database di test

- Un solo Postgres 17 + pgvector per job, lo stesso motore della produzione.
- In locale: `deploy/compose.dev.yml`; in CI: service container di GitHub Actions.
- Database dedicato `nando_test`, puntato da `TEST_DATABASE_URL`.
- Le migrazioni si applicano una volta per job; fra un test e l'altro si esegue `TRUNCATE ... CASCADE` su tutte le tabelle applicative, escluso il journal delle migrazioni.
- La suite integration gira **seriale** (`fileParallelism: false`); la suite unit gira in parallelo.
- Niente Testcontainers: Docker è già richiesto dal compose locale e il service container è più semplice in CI.
- Niente transazione con rollback: pg-boss ha bisogno di commit reali.

### Servizi esterni

- **Postgres è l'unico servizio reale.**
- AI gateway, notifier email (Resend) e storage (R2) sono porte sostituite da fake in memoria che registrano le chiamate e permettono asserzioni.
- Niente MinIO o Mailpit nella suite principale: aggiungono container e non provano il codice che conta.
- Un contract test dell'adapter reale può esistere fuori dalla suite principale, ma non è un gate di merge.

### Test del worker

- I singoli handler si provano come integration test, con Postgres e dipendenze reali.
- Un solo test verifica la registrazione e l'esecuzione di un job attraverso pg-boss.
- Non si avvia il worker per ogni job: sarebbe lento e fragile senza aggiungere copertura di dominio.

### Comandi

```text
pnpm typecheck          # TypeScript, tutti i workspace
pnpm lint               # oxlint + Prettier
pnpm test               # unit, senza Docker
pnpm test:integration   # integration, richiede Postgres
pnpm build              # build di web, api, worker
pnpm db:check           # drizzle-kit generate + git diff, niente drift
pnpm verify             # typecheck + lint + db:check + test + test:integration + build
```

- `pnpm test` è **solo unit**: veloce e senza Docker.
- `pnpm test:integration` richiede `TEST_DATABASE_URL`; se manca, lo script avvia `deploy/compose.dev.yml` con `docker compose up -d --wait`, applica le migrazioni e lascia il container acceso. In CI la variabile punta al service container e il compose non parte.
- Se Docker o Postgres non sono disponibili, `pnpm test:integration` e `pnpm verify` **falliscono con un messaggio azionabile**; non saltano la suite in silenzio.
- `pnpm verify` è l'unico comando che un agente esegue prima di aprire una PR. È lo stesso comando in locale e in CI, anche se la CI lo spezza in job paralleli.

### CI

Quattro job paralleli su GitHub Actions, `ubuntu-latest`, Node 24 e pnpm 9:

| Job | Cosa esegue | Blocca il merge |
| --- | --- | --- |
| `static` | `pnpm typecheck`, `pnpm lint`, `pnpm db:check` | sì |
| `unit` | `pnpm test` | sì |
| `integration` | `pnpm test:integration` con Postgres 17 + pgvector | sì |
| `build` | `pnpm build`; su `main` e tag anche immagine Docker e push su GHCR | sì |

- L'immagine viene pubblicata solo su `main` o tag; una PR valida il build dell'app, non produce artefatti.
- Il budget è **dieci minuti** dall'apertura della PR all'esito. Se si sfora, si ottimizza cache o si sposta un test; non si allunga il budget.
- Nessun retry automatico. Un test instabile si corregge o si mette in quarantena con un issue lo stesso giorno.
- Coverage e test UI non sono gate di merge.

### Migrazioni

- `pnpm db:check` esegue `drizzle-kit generate` e fallisce se `git diff --exit-code` trova SQL non committato. Rileva il drift fra schema Drizzle e migrazioni.
- Il job `integration` applica tutte le migrazioni su un Postgres vuoto. Questo prova che la catena è completa e riproducibile.
- **Nessun test di upgrade dalla release precedente in CI.** L'upgrade reale si prova su staging prima della produzione; il restore mensile di ADR-0011 copre il ripristino.
- Le migrazioni restano forward-only; un rollback che richiede una down-migration non è un percorso supportato.

### Smoke di deploy

Il wrapper controlla, dopo il deploy:

1. `web /healthz` — liveness del processo esposto, senza database;
2. `docker compose ps` — `api` in stato `healthy`; il healthcheck Docker di `api` chiama `/api/health` dentro il container, che esegue `SELECT 1` sul database.

Nessun `docker compose exec`, nessun proxy `/api/health` su `web`, nessun endpoint di debug. Lo smoke vale identico per staging e produzione, dentro il wrapper che fa già il rollback.

Cloudflare Access non si testa in CI: lo smoke gira su `127.0.0.1` e bypassa il bordo. L'accesso reale resta una checklist operativa dopo il deploy (ADR-0012).

### Cosa non è un gate

- **Smoke di staging:** avviene dopo il merge; se fallisce blocca il deploy, non la PR.
- **Coverage:** report advisory; il criterio è che ogni invariante di dominio e ogni route group abbiano un test.
- **Access, performance, a11y, visual regression:** fuori dalla CI in v1.

## Schema concettuale

```text
PR
 ├─ static        typecheck, lint, db:check
 ├─ unit          pnpm test            (parallelo, senza Docker)
 ├─ integration   pnpm test:integration (Postgres 17 + pgvector, seriale)
 └─ build         pnpm build           (immagine solo su main/tag)
        │
        └─ merge su main
              └─ deploy staging (Dokploy)
                    ├─ migrate (one-shot)
                    ├─ web /healthz
                    └─ compose ps: api healthy ─▶ /api/health ─▶ SELECT 1
                          │
                          └─ fallimento: rollback al tag precedente

Locale
  pnpm verify
    ├─ typecheck, lint, db:check
    ├─ test (unit)
    ├─ test:integration
    │     └─ TEST_DATABASE_URL assente? docker compose up -d --wait
    └─ build
```

## Invarianti

1. `pnpm verify` è l'unico comando prima di una PR; fa le stesse cose in locale e in CI.
2. `pnpm test` è solo unit e non richiede Docker.
3. L'integration non viene mai saltata in silenzio: senza Postgres il comando fallisce.
4. Un Postgres per job, migrazioni una volta, `TRUNCATE ... CASCADE` fra i test, suite seriale.
5. Postgres è l'unico servizio reale; AI, email e storage sono porte fake.
6. Gli unit test non fanno I/O; gli integration test usano il database reale.
7. Nessun retry automatico sui test instabili.
8. Il merge richiede `static`, `unit`, `integration` e `build` verdi.
9. Lo smoke controlla `web /healthz` e `api healthy` via healthcheck Docker; Access è fuori dalla CI.
10. Nessuna soglia di coverage in v1.
11. Le migrazioni sono forward-only; la CI applica la catena su un database vuoto, l'upgrade si prova su staging.
12. Il budget della CI di una PR è dieci minuti.

## Conseguenze

- **ADR-0010:** il contratto degli script si arricchisce di `test:integration`, `db:check` e `verify`; `deploy/compose.dev.yml` diventa un prerequisito per l'integration locale; il compose di `api` deve avere un healthcheck che chiami `/api/health`.
- **ADR-0013:** «test in CI» significa test di dominio e integration sull'API, non browser E2E. La p95 resta una misura di produzione, non un test.
- **ADR-0011:** il restore mensile resta un'operazione documentata e non entra nella CI.
- **ADR-0012:** Access resta fuori dai test automatici; lo smoke è locale al processo.
- **NAS-102:** la riscrittura dei documenti VPS deve recepire lo smoke con healthcheck Docker e i nuovi script, al posto del vecchio `curl` su un solo container.
- **NAS-53:** la roadmap può assumere `pnpm verify`, quattro job CI e un costo di test per capability.
- **Implementazione:** la prima PR di codice deve portare Vitest, il setup del database di test, `deploy/compose.dev.yml`, il healthcheck di `api` e i workflow. Fino ad allora `pnpm verify` è un contratto, non un comando esistente.

## Alternative scartate

- **Jest:** maturo, ma più lento e duplica la configurazione Vite che `web` usa già.
- **node:test:** zero dipendenze, ma niente projects, mocking e coverage all'altezza.
- **Testcontainers:** isolamento per file, ma avvio più lento e Docker obbligatorio a ogni run.
- **Transazione con rollback:** veloce, ma incompatibile con i commit reali di pg-boss.
- **Template database per worker:** parallelismo vero, complessità sproporzionata a un single-user.
- **Seed globale condiviso:** meno codice, ma test accoppiati e fragili.
- **Playwright in v1:** fragilità e manutenzione senza provare i flussi di dominio meglio dell'integration; si rivaluta dopo due regressioni UI sfuggite.
- **Pact:** contratti versionati e broker per un solo consumatore e un solo provider.
- **MinIO e Mailpit in CI:** container in più per adapter che le porte fake coprono già.
- **`packages/testing`:** un posto solo, ma nono workspace e confine in più rispetto ad ADR-0010.
- **Test di upgrade in CI:** lento e con uno stato di partenza da mantenere; staging e restore mensile coprono il rischio.
- **Soglia di coverage:** spinge a testare righe facili; gli invarianti e i route group sono il criterio.
- **Retry automatico:** nasconde le race e rende il verde meno significativo.
- **Un solo job CI:** più semplice da leggere, ma ogni fallimento rifà tutta la catena.
- **Smoke via `docker compose exec` o proxy `/api/health`:** aggiunge un comando o una route per una informazione che il healthcheck Docker già espone.
- **Access in CI:** richiede service token e dipendenza dalla configurazione Cloudflare per un cancello che non è codice applicativo.
- **Performance e a11y in CI:** costosi e fragili su un runner ospitato; la p95 si misura in produzione e l'accessibilità resta una revisione manuale.
