# 0022 — Contratto HTTP fra web e api

- **Stato:** accettato
- **Data:** 2026-11-06
- **Ticket:** NAS-131 — Contratto HTTP web↔api: proxy, AppType, OpenAPI e docs:check
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Correlato:** NAS-53 — Roadmap v1: sequenza, milestone, criteri di done
- **Dipende da:** ADR-0003, ADR-0010, ADR-0012, ADR-0021
- **Chiarisce:** ADR-0012 (origin check sul proxy), ADR-0021 (`docs:check` in `verify`)

## Contesto

ADR-0010 ha fissato la forma del repository e la separazione dei processi: `web` è l'unico processo raggiungibile dal bordo, `api` possiede dominio e database, `worker` esegue i job. Ha anche fissato il canale `web → api` con `hc<AppType>`, senza codegen e senza un contratto mantenuto a mano.

Restavano aperte le decisioni che rendono quel canale utilizzabile:

- come il browser raggiunge `api`, che non è esposta;
- che forma ha il wire: comandi, query, errori, date, ID, idempotenza;
- come si vedono le API e le response di esempio senza creare un secondo contratto;
- come restano allineati implementazione, documentazione Scalar e mock.

Il repository non ha ancora codice. È il momento in cui queste regole costano meno, perché non ci sono route da migrare né mock da riconciliare.

La scelta di fondo è mantenere **implementazione e documentazione Scalar separate**. `describeRoute` resta una dichiarazione distinta dall'handler. L'allineamento non è garantito dal tipo, ma da schemi condivisi e da controlli che falliscono in CI. Questo ADR registra anche questo trade-off, non solo la forma del contratto.

## Decisione

### Confine del contratto

- I pacchetti di dominio (`packages/kernel`, `packages/core`, `packages/capability-*`) non conoscono HTTP. Espongono comandi, query e porte.
- `apps/api/src/http` è il contratto wire: route, schemi Zod di request e response, mapper dominio → DTO, envelope.
- `AppType` nasce da `apps/api` ed è l'unica fonte per il client. `apps/web` può importarlo **solo come tipo**, da un entrypoint solo-tipi. Il runtime di `api` non è importabile da `web`.
- Nessun `packages/contract`: sarebbe un nono workspace e una seconda verità. Nessun codegen del client.
- I DTO sono espliciti. Non sono entità di dominio, non contengono `Date`, tipi Drizzle, brand o campi che il wire non serializza.
- Zod vive in `api`. Valida le request a runtime. Gli schemi di response servono per documentazione, esempi e test; non vengono eseguiti su ogni risposta in produzione.

### Trasporto

- **Browser → web, same-origin.** Il browser chiama `/api/*` su `web`; `web` inoltra ad `api` e aggiunge il bearer interno. `api` non è raggiungibile dal browser e non ha CORS.
- **SSR → api, diretto.** Il server di `web` usa lo stesso `hc<AppType>` con `API_URL` e `INTERNAL_TOKEN`.
- Un solo client tipizzato, creato da una factory che sceglie base URL e credenziali in base al contesto. Il token non entra mai nel bundle del browser.
- Il proxy:
  - accetta solo path sotto `/api/`, senza URL assolute e senza riscritture;
  - inoltra metodo, query e body;
  - inoltra un'allowlist di header (`content-type`, `accept`, `accept-language`, `last-event-id`, `range`); scarta `authorization`, `cookie` e gli header hop-by-hop;
  - aggiunge il bearer interno e un `x-request-id` se assente;
  - propaga l'abort del client;
  - non bufferizza `text/event-stream`;
  - applica un limite configurabile al body;
  - applica un **origin check** esplicito su tutte le mutazioni (`Origin` e `Sec-Fetch-Site` same-origin). Questo sostituisce, per il percorso del browser, l'origin check che TanStack Start fa sulle server function.
- Le server function restano disponibili per orchestrazioni specifiche del web, ma non sono il contratto predefinito del browser.

### Comandi e query

- Due verbi: query `GET` senza effetti e comandi `POST`. Niente CRUD generico.
- Ogni comando porta nel body `commandId`, un UUIDv7 generato dal client una volta per intenzione e riusato nei retry.
- `actorId`, `source`, `occurredAt`, `correlationId` e `causationId` sono ricostruiti dal server. Il client non li invia.
- `commandName` è deciso dalla registrazione della route, non dal client. Resta stabile anche se il path cambia.
- L'envelope completo di ADR-0003 resta interno ai moduli. Sul wire viaggia solo `{ commandId, ...payload }`.
- Le route sono resource-first per le query e command subpath per le mutazioni:

  ```text
  GET  /api/tasks?cursor=...
  GET  /api/tasks/{taskId}
  POST /api/task-occurrences/{occurrenceId}/complete
  POST /api/task-occurrences/{occurrenceId}/skip
  POST /api/tasks/{taskId}/cancel
  ```

  La convenzione fissa la forma; i nomi esatti si decidono nella fetta verticale che li introduce.

### Envelope e errori

Risposta di successo:

```ts
type SuccessEnvelope<T> = {
  ok: true
  data: T
  meta?: { affected?: EntityRef[] }
}
```

Risposta di errore:

```ts
type ErrorEnvelope = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
    retryable?: boolean
  }
  requestId: string
}
```

- `code` è stabile e in inglese; `message` è italiano e già sicuro da mostrare; `details` è strutturato per i form.
- Un solo mapper `Result` del kernel → HTTP. Gli errori di dominio non si lanciano; quelli imprevisti diventano `internal_error` con `requestId` e stack nei log.
- Mappatura:

  | Caso | HTTP | `code` |
  | --- | --- | --- |
  | input non valido | 400 | `validation_error` |
  | bearer interno assente o errato | 401 | `unauthorized` |
  | scope o grant negato | 403 | `forbidden` |
  | entità assente o tombstone | 404 | `not_found` |
  | stato incompatibile, versione, replay incoerente | 409 | `conflict`, `version_conflict`, `idempotency_key_reuse` |
  | regola di dominio violata | 422 | `domain_rule_violation` |
  | rate limit | 429 | `rate_limited` |
  | errore imprevisto | 500 | `internal_error` |
  | dipendenza non disponibile | 503 | `dependency_unavailable` |

- `401` non dovrebbe mai raggiungere il browser: se succede, è un errore di configurazione fra `web` e `api`.

### Idempotenza, ID e concorrenza

- Il server conserva `(actorId, commandName, commandId) → result` per 30 giorni, come da ADR-0011. Un replay restituisce lo stesso risultato.
- Stessa chiave con payload diverso → `409 idempotency_key_reuse`.
- Il proxy non ritenta mai un `POST` da solo. Il client può ritentare con lo stesso `commandId`.
- Il server genera gli ID delle entità. Il client genera solo `commandId`.
- Un `id` nel payload di create è un errore di contratto, non un'adozione dell'ID del client.
- Per l'ottimismo il FE usa ID temporanei locali, mai inviati, e li sostituisce con la risposta.
- `expectedVersion` esiste solo per gli update di contenuto (documento, property). I comandi di intento (`complete`, `skip`, `cancel`) non hanno versione.
- Conflitto di versione → `409 version_conflict` con la versione corrente in `details`.

### Forma JSON

- Timestamp: stringa ISO 8601 UTC con millisecondi e `Z`.
- Date senza orario: `YYYY-MM-DD`.
- Timezone: stringa IANA.
- ID: stringhe UUIDv7.
- Nullabilità: un valore che può mancare è `T | null` e la chiave è presente. Non si usa l'assenza per dire "vuoto".
- Liste: sempre array, mai `null`.
- Money: intero in unità minime più valuta, mai float.
- `PropertyValue`: union taggata per tipo (`text`, `number`, `date`, `select`, `link`, `bool`), non una fila di campi nullable paralleli.
- `Schedule` segue il glossario: `allDay`, `from?`, `to`, `timeZone`.
- I DTO usano `z.iso.datetime()` o `z.string()`, mai `z.date()`. Il tipo deve corrispondere a ciò che JSON restituisce davvero.

### Liste e versioning

- Paginazione a cursore opaco: `cursor`, `limit` (default 50, massimo 100), `nextCursor: string | null`.
- Niente `total` nelle liste generali in v1; solo query dedicate.
- L'ordinamento è una union tipizzata per endpoint, non una stringa libera.
- Nessun `/v2`. Le modifiche sono additive per una release: si aggiunge, si migra il client, poi si rimuove. `web` e `api` escono dalla stessa immagine ma non sono atomici durante il deploy.
- Il client ignora i campi e gli eventi che non conosce.

### SSE

- `GET /events` è lo stream persistente per notifiche e invalidazioni. `Last-Event-ID` riprende dal cursore; le notifiche sono persistite e riproducibili.
- Lo streaming AI usa una route dedicata sotto `/api/ai/...` con risposta `text/event-stream`, stesso origin, relayata da `web`. È effimero: niente replay.
- Gli eventi client sono una union proiettata dai domain event. **I domain event dell'outbox non arrivano mai al browser.**
- Ogni evento ha `eventId`, `type`, `version`, `occurredAt` e il payload.
- Il client proietta solo i tipi noti e ignora il resto, così un evento nuovo non rompe una UI vecchia durante il deploy.
- Heartbeat periodico; compressione e buffering disattivati; abort propagato.

### OpenAPI e Scalar

- `hono-openapi` per descrivere le route Hono esistenti: `describeRoute`, `validator`, `openAPIRouteHandler`.
- `@scalar/hono-api-reference` per la reference.
- `api` espone:
  - `GET /api/openapi.json` — lo spec generato;
  - `GET /api/reference` — Scalar.
- Lo spec usa i path completi `/api/...`; `servers` è `/`, così il pulsante "Try it" resta same-origin e passa dal proxy.
- `DOCS_ENABLED` controlla la registrazione delle route di documentazione: accesa in locale e staging, spenta in produzione per default. Se accesa in produzione, resta dietro Access.
- Gli esempi vivono negli schemi o nelle response. Devono venire dalle stesse factory delle fixture; un esempio scritto a mano è tipizzato con `z.infer` dello schema.
- OpenAPI è un **artefatto derivato**, non la fonte del client. Nessun codegen, nessuno spec committato per default.
- Scalar carica il bundle da CDN per default. Se si introduce una CSP stretta, va self-hostato o autorizzato.
- Nei comandi `POST` l'esempio include un `commandId`. Replayare lo stesso esempio restituisce lo stesso risultato: è corretto, ma va scritto nella descrizione della route.

### Allineamento fra implementazione, Scalar e mock

Il punto di verità è un modulo di contratto per route group:

```text
apps/api/src/http/tasks/
  contract.ts      schemi Zod di request e response, DTO, esempi, factory
  routes.ts        describeRoute + validator + handler
  mapper.ts        dominio → DTO
  routes.test.ts   integration test + safeParse delle risposte
```

La forma per un gruppo con più operazioni è precisata nell'emendamento 2026-11-11 in fondo.

`contract.ts` esporta:

- lo schema di request, usato sia da `validator` sia da `describeRoute`;
- gli schemi di response, usati da `describeRoute`, dagli esempi e dai test;
- i tipi DTO come `z.infer` degli schemi;
- le factory e gli esempi usati dallo stub, dalla documentazione e dai test.

Regole:

- Nessuna seconda copia di uno schema, di un esempio o di un mock.
- Lo stub è una route reale di `api` che restituisce le fixture. Non esiste un mock layer separato, né MSW, né oggetti mock scritti a mano.
- Ogni route group ha almeno un integration test che chiama la route e fa `safeParse` della risposta contro lo schema documentato.
- `pnpm typecheck` è il gate del client: se una route cambia, `web` non compila.
- `pnpm docs:check`:
  - genera lo spec senza avviare il server;
  - confronta le route registrate con i path e i metodi dello spec;
  - verifica che ogni response documentata abbia uno schema e un esempio (almeno i 2xx e l'envelope di errore condiviso);
  - valida lo spec come OpenAPI 3.1;
  - fallisce con un messaggio azionabile.

`docs:check` entra in `pnpm verify` e nel job CI `static`. Questo modifica il contratto degli script di ADR-0021:

```text
pnpm verify = typecheck + lint + db:check + docs:check + test + test:integration + build
```

### Disciplina per gli agenti

`AGENTS.md` riceve una regola breve; il dettaglio vive in `docs/agents/api-contract.md`.

Testo della regola:

```md
## API contract

Read `docs/agents/api-contract.md` before changing anything under `apps/api`
or the web API client.

- Every route uses `describeRoute` and shares its request/response Zod schemas
  with the validator, the integration test, and the fixtures. Never a second copy.
- An endpoint is not done until `pnpm docs:check` passes: the route appears in
  the spec, every documented response has an example, and every real response
  passes `safeParse`.
- Examples and mocks come from the same factories as the test fixtures.
  No hand-written JSON or hand-written mock objects.
- Changing a route updates the web client in the same PR; `pnpm typecheck` is the gate.
- Scalar descriptions are part of the contract: if behavior changes, the
  description changes in the same PR.
```

`docs/agents/api-contract.md` contiene la checklist operativa: dove vivono gli schemi, come si aggiunge una route, cosa significa "endpoint finito", quali comandi eseguire, come si costruisce un esempio, quali parti restano manuali.

### Definizione di "endpoint finito"

Un endpoint non è finito finché non valgono tutte queste condizioni:

1. la route è registrata con `describeRoute`;
2. request e response usano gli schemi di `contract.ts`, senza copie;
3. esiste un esempio tipizzato per ogni response documentata;
4. esiste un integration test che prova il comportamento e fa `safeParse` della risposta;
5. `pnpm docs:check` e `pnpm typecheck` passano;
6. il client `web` che la usa compila;
7. la descrizione Scalar dice cosa fa il comando e quali errori può restituire.

### Cosa resta manuale

- `summary`, `description` e `tags`: sono prosa. Nessun tipo verifica che descrivano il comportamento giusto.
- La semantica: uno schema non sa cosa significa "complete" rispetto a "skip".
- La copertura runtime di ogni ramo: il contract test copre i casi scritti, non tutti quelli possibili.

Queste parti restano review. La regola "stesso PR" è l'unica difesa; il resto è automatizzato.

## Schema concettuale

```text
Browser
  ├─ /api/* same-origin ──▶ web proxy ── bearer ──▶ api ──▶ dominio
  └─ /events SSE ─────────▶ web relay ───────────▶ api

SSR
  └─ hc<AppType> + API_URL + INTERNAL_TOKEN ─────▶ api

apps/api/src/http/tasks/
  contract.ts
    ├─ request schema ─────▶ validator
    ├─ response schemas ───▶ describeRoute ──▶ OpenAPI ──▶ Scalar
    ├─ DTO types ──────────▶ AppType ────────▶ web hc
    └─ examples/factories ─▶ stub route + integration test

Gates
  pnpm typecheck         route cambiata? web non compila
  pnpm docs:check        route ↔ spec, esempi, OpenAPI valido
  pnpm test:integration  response reali → safeParse
```

## Invarianti

1. `AppType` è l'unico contratto del client; nessun codegen e nessun DTO mantenuto a mano in `web`.
2. `web` non importa mai il runtime di `api`, né Drizzle, né i pacchetti di dominio.
3. Il browser non parla mai direttamente con `api`; un solo origin, nessun token nel browser.
4. Ogni mutazione ha un `commandId`; il replay restituisce lo stesso risultato.
5. Il client non genera ID di entità; gli ID temporanei restano locali.
6. Nessun `Date` nei DTO: il wire usa stringhe ISO.
7. Nessun domain event dell'outbox sul wire; solo eventi client proiettati.
8. Ogni route ha `describeRoute`; ogni response documentata ha schema ed esempio.
9. Ogni route group ha un contract test che fa `safeParse` delle risposte.
10. Esempi, stub e fixture derivano dallo stesso `contract.ts`.
11. `docs:check` è dentro `pnpm verify` e nella CI `static`.
12. Le modifiche al wire sono additive per una release.
13. La documentazione Scalar non è la fonte del contratto e non è parte della UI di prodotto.

## Conseguenze

- **ADR-0010:** la topologia non cambia; `web` guadagna una route proxy e un entrypoint solo-tipi verso `api`. `api` resta l'unico scrittore del database.
- **ADR-0012:** l'origin check del percorso browser si sposta sul proxy. Le server function restano protette, ma non sono il default. Access resta l'unico cancello.
- **ADR-0021:** `verify` e il job `static` includono `docs:check`; gli integration test includono il `safeParse` delle risposte. Il budget CI resta dieci minuti: `docs:check` deve essere veloce.
- **ADR-0003:** l'envelope HTTP è una semplificazione di quello interno; `actorId`, `source` e gli altri metadati li ricostruisce il server. L'idempotenza resta per `(actorId, commandName, commandId)`.
- **ADR-0011:** la retention dell'idempotenza resta 30 giorni; non serve nuova persistenza.
- **ADR-0007:** le Proposal applicano comandi lato server con `source=ai`; non passano dal proxy del browser.
- **ADR-0013:** Scalar è strumentazione di sviluppo, non una schermata del prodotto; nessun impatto sul design system.
- **Nuovi documenti:** `docs/agents/api-contract.md`; la regola in `AGENTS.md`.
- **Diagrammi:** `docs/architecture/diagrams.md` §3 è aggiornato con il proxy `/api/*` e la reference; la topologia non cambia.
- **Prima PR di codice:** proxy, entrypoint solo-tipi, `contract.ts` del primo route group, `hono-openapi`, Scalar, `docs:check`, harness dei contract test, regola in `AGENTS.md`.
- **NAS-53:** il contratto HTTP è un prerequisito della prima fetta verticale; la roadmap può assumere stub contract-first e `docs:check`.

## Alternative scartate

- **Browser diretto su `api`:** l'API non è esposta, servirebbe CORS e il bearer finirebbe nel browser.
- **Una server function per operazione:** è più idiomale TanStack, ma crea una seconda superficie da mantenere (validator + handler) e duplica il contratto. Le server function restano per orchestrazioni web-specific.
- **`@hono/zod-openapi`:** garantisce l'allineamento a livello di tipo fra route, handler e spec, ma impone `createRoute`/`OpenAPIHono`, ha un problema noto di inferenza `hc` con path parameter non-stringa e un typecheck più lento. In v1 si preferisce la separazione con controlli automatici.
- **OpenAPI-first + codegen:** reintroduce il codegen e una seconda verità, contro ADR-0010.
- **`packages/contract`:** un nono workspace e schemi runtime condivisi col browser, con coupling e versioning.
- **Zod condiviso con `web`:** porta Zod e gli schemi nel bundle del client e rende `web` dipendente dal runtime di `api`.
- **DTO uguali alle entità di dominio:** fanno trapelare `Date`, Drizzle e brand; ogni cambio di dominio diventa un cambio di wire non intenzionale.
- **Domain event dell'outbox sul wire:** accoppia il browser agli internals e rende l'outbox un'API pubblica.
- **ID delle entità generati dal client:** il server perde autorità su formato e unicità; gli ID temporanei locali bastano per l'ottimismo.
- **Mock scritti a mano o MSW:** terza copia del contratto, destinata a divergere. Lo stub è una route reale.
- **Spec OpenAPI committato:** rumore nel repository; lo spec si genera on demand e `docs:check` lo valida.
- **Validare ogni response in produzione:** costo inutile; i contract test coprono il drift.
- **`@rcmade/hono-docs`:** genera lo spec analizzando `AppType` a build time, ma è meno consolidato e aggiunge un altro strumento; possibile rivalutazione futura.
- **Un servizio separato per la documentazione:** un processo e un deploy in più per una pagina dietro Access.

## Questioni aperte

- I nomi esatti delle route per ogni modulo: la convenzione è fissata, i nomi si decidono nella fetta che li introduce.
- Se pubblicare lo spec come artefatto CI o su Scalar Registry: non serve in v1.
- Il rate limit `429`: codice riservato, non implementato in v1.
- Il multiplexing dello streaming AI: la route dedicata è decisa, il formato dei singoli eventi si finalizza con la fetta AI.
- `meta.affected` per ogni comando: si decide caso per caso, non è obbligatorio.
- TanStack Query o loader per il consumo lato web: fuori da questo ADR.

## Emendamento 2026-11-11 — contratto e route per operazione

**Stato:** accettato. Precisazione della sezione *Allineamento fra implementazione, Scalar e mock*.

Un route group con più operazioni organizza il contratto in `contract/`: `shared.ts` per le forme
comuni e `index.ts` come superficie pubblica, che ri-esporta i `contract.ts` delle singole
operazioni. Le route vivono in `operations/<operation>/route.ts`; `routes.ts` compone i registrar e
applica l'autenticazione del gruppo. `http/route-support.ts` contiene il supporto condiviso fra
gruppi: callback di validazione, response d'errore comuni e il tipo del router.

```text
apps/api/src/http/<group>/
  contract/
    index.ts                  superficie pubblica: shared + operazioni
    shared.ts                 schemi e DTO condivisi
  operations/
    <operation>/
      contract.ts             schemi, DTO, esempi, factory dell'operazione
      route.ts                describeRoute + validator + handler
  mapper.ts                   dominio -> DTO condiviso
  routes.ts                   composizione + auth del gruppo
```

Regole:

- Nessuna forma wire fuori da `contract/` o da `operations/<operation>/contract.ts`.
- I contract delle operazioni importano `contract/shared.ts`, mai `contract/index.ts`, così il
  barrel non crea cicli.
- `contract/index.ts` resta l'unica superficie usata da test, esempi e strumenti.
- `route.ts` non dichiara schemi: importa il proprio `contract.ts` e il supporto condiviso.
- Un gruppo con una sola operazione può restare `contract.ts` + `routes.ts`; la struttura per
  operazione si adotta quando il gruppo cresce.
- L'invariante non cambia: un solo contratto per gruppo, nessuna seconda copia, `docs:check` verde.
