# Stack Cloudflare: cosa regge davvero

**Ticket:** NAS-48 — *Stack Cloudflare: cosa regge davvero*
**Data di accesso alle fonti:** 2026-10-26
**Stato:** ricerca conclusa, nessuna decisione architetturale ratificata
**Ambito:** vincoli reali di Cloudflare Workers su Nando (runtime, hosting TanStack Start, database, job e reminder, file storage, streaming e AI long-running, WebSocket, observability).

> Nota di metodo: ogni affermazione tecnica qui sotto è ancorata a documentazione ufficiale del vendor, con la data di ultimo aggiornamento della pagina e la data di accesso. Dove la documentazione è internamente incoerente, è segnalato esplicitamente. Le implicazioni per Nando sono marcate come **raccomandazione**, non come decisione.

---

## 0. Cosa deve reggere Nando

Dal documento di handoff (`docs/brainstorming/handoff.md`) derivano i carichi che contano per questa valutazione:

| Carico | Natura tecnica | Peso sul runtime |
|---|---|---|
| Shell, Dashboard, Knowledge, Tasks, Calendar | SSR + server functions + CRUD relazionale | molte richieste brevi, latenza interattiva |
| AI trasversale con approvazione | streaming di token, tool call, generazione di piani lunghi | connessioni lunghe in uscita, job di minuti |
| Habits: evidenze, periodi, score | scritture idempotenti, aggregazioni per periodo, timezone | correttezza transazionale, dedup |
| Reminder individuali e riepiloghi (opt-in) | scheduling nel futuro, per utente, timezone-aware | job durevoli, non `setTimeout` |
| Learning: piani versionati | generazione lunga + persistenza di output grande | step lunghi, storage |
| Relationships: import (export WhatsApp, Calendar, email) | upload file, parsing, estrazione, review queue | batch, memoria, storage oggetti |
| Privacy per scope (Romantic vs Professional) | filtri applicativi, audit, provenienza | moderato, ma strutturale |

Il vincolo dominante non è la scala (utente singolo), è la **forma dei carichi**: poche richieste ma con code lunghe, job differiti di giorni e stream AI di decine di secondi.

---

## 1. Runtime Workers: i limiti che contano

### 1.1 CPU, durata, memoria

Fonte primaria: *Workers — Limits* (ultimo aggiornamento 2026-10-12).

| Dimensione | Free | Paid |
|---|---|---|
| CPU per richiesta HTTP | 10 ms | 5 min max, **default 30 s** (`limits.cpu_ms`) |
| CPU per Cron Trigger | 10 ms | 30 s (intervallo < 1 h) / 15 min (intervallo ≥ 1 h) |
| Memoria per isolate | 128 MB | 128 MB |
| Durata (wall clock) richiesta HTTP | nessun limite finché il client è connesso | idem |
| Durata Cron / Queue consumer / DO alarm | — | 15 min |
| Subrequest per invocazione | 50 | 10.000 (configurabile fino a 10M) |
| Connessioni simultanee in attesa di header | 6 | 6 |
| Worker bundle non compresso | 64 MiB | 64 MiB |
| Startup (global scope) | 1 s | 1 s |
| Body richiesta in ingresso | 100 MB (piano Cloudflare Free/Pro) | 100 MB (200 MB Business) |
| Log per richiesta | 256 KB | 256 KB |

Punti decisivi:

- **La CPU non è il tempo di parete.** Attendere `fetch`, un database o un LLM non consuma CPU. Un endpoint che fa streaming di token consuma CPU quasi nulla: il collo di bottiglia è la connessione, non il processore.
- **La CPU invece morde sul rendering SSR.** La documentazione stima 10–20 ms di CPU per richieste che fanno SSR o parsing di payload; il piano Free ne concede 10 ms per richiesta. Con TanStack Start in SSR il Free plan è al limite per definizione, non per sfortuna.
- **Nessun limite di durata sulle richieste HTTP** finché il client resta connesso. Questo è ciò che rende possibile lo streaming AI. Non è però una garanzia di continuità: il runtime può essere aggiornato, e in quel caso le richieste in corso hanno una finestra di grazia fino a 20 minuti prima di essere chiuse.
- **`waitUntil()` allunga la vita solo di 30 secondi** dopo la risposta o la disconnessione del client. Non è un meccanismo per job lunghi, è un meccanismo per flush e log.
- **Sei connessioni in attesa di header per richiesta.** Vince chi apre connessioni in parallelo: un fan-out su 10 tool call o 10 query simultanee viene serializzato/accodato oltre la sesta. È un limite di *fan-out*, non di throughput totale.

### 1.2 Cosa significa per Nando

- Un solo Worker può servire SSR, server functions, API e streaming: l'architettura "modular monolith" non richiede più Worker.
- Il piano **Workers Paid ($5/mese)** è di fatto obbligatorio appena c'è SSR + AI: include 10M richieste e 30M CPU-ms al mese, con CPU per invocazione portabile a 5 minuti. Per un utente singolo il costo resta vicino ai 5 dollari.
- Il pattern "risposta immediata + lavoro in background" non si implementa con `waitUntil` oltre i 30 s: serve Queues, Workflows o Durable Objects (sezione 4).

---

## 2. Hosting TanStack Start

Fonti: *Cloudflare — TanStack Start* (2026-10-13); *TanStack Start — Hosting* (accesso 2026-10-26).

**Funziona oggi, ed è un percorso supportato da entrambi i vendor.** Cloudflare ha una guida dedicata e `wrangler deploy` riconosce e configura automaticamente un progetto TanStack Start. TanStack elenca Cloudflare Workers come *Official Hosting Partner*.

Configurazione canonica lato Cloudflare:

- `@cloudflare/vite-plugin` con `viteEnvironment: { name: "ssr" }`, più `tanstackStart()` e il plugin React;
- `main: "@tanstack/react-start/server-entry"`;
- `compatibility_flags: ["nodejs_compat"]` (per compatibility date ≥ 2026-08-04 il supporto Node è attivo di default e il flag può essere omesso);
- `observability.enabled: true`.

Vincoli e workaround:

1. **Niente Rsbuild.** Cloudflare dichiara esplicitamente di non supportare progetti TanStack Start basati su Rsbuild: va usato Vite. Non è un dettaglio di preferenza, è un blocco.
2. **Nessun adattatore intermedio.** Se la config Vite contiene già un adapter di deployment (es. `nitro()`), va rimosso prima di aggiungere il plugin Cloudflare.
3. **Entrypoint custom per tutto ciò che non è HTTP.** Queue consumer, handler `scheduled` (Cron), classi Workflow e Durable Object si esportano da un server entrypoint proprio che ri-esporta `handler.fetch`. È il punto in cui il "modular monolith" incontra la piattaforma: un file, molti handler.
4. **Niente filesystem persistente.** Non esiste una directory di lavoro: upload e artefatti vanno su R2 (sezione 5). Un import di export WhatsApp non può essere "letto da disco".
5. **Static assets.** Il Worker può servire fino a 100.000 file (25 MiB ciascuno) per versione sul piano Paid: sufficiente per il bundle client di TanStack, non per i contenuti utente.
6. **Prerendering a build time.** Se attivato, gira in build e usa variabili, segreti e binding *locali*: non è un modo per generare pagine con dati di produzione senza remote bindings.

**Raccomandazione:** TanStack Start su Workers è una scelta a basso rischio tecnico; il rischio è nel modello di deploy (Vite-only) e nella disciplina di tenere separati handler HTTP e handler di background.

---

## 3. Database: Neon Postgres / Turso / D1

### 3.1 Il contesto è cambiato: Neon è "Lakebase Postgres"

Al 2026-10-26 la documentazione Neon si presenta come *Neon Postgres … built around Lakebase Postgres … from Databricks*, con un set di primitive che va oltre il database (Auth gestita, Object Storage S3-compatibile, AI Gateway, Functions, Realtime). Il driver serverless (`@neondatabase/serverless`) resta lo stesso e resta la via documentata per Workers. Conseguenza pratica: **la scelta "Neon" oggi è la scelta di un fornitore Postgres dentro l'ecosistema Databricks**, con un perimetro prodotto più ampio di un database gestito. Va valutato anche per lock-in, non solo per latenza.

### 3.2 Come si connette ciascuno a Workers

| Opzione | Meccanismo | Note |
|---|---|---|
| **Neon (Lakebase)** | Hyperdrive (consigliato da Neon) + driver Postgres nativo (`pg`, `postgres.js`); oppure Neon serverless driver su HTTP/WebSocket | Hyperdrive fa pooling e caching; il driver HTTP evita TCP |
| **Turso** | SQL over HTTP (`/v2/pipeline`) con `@tursodatabase/serverless` (solo `fetch`) o `@libsql/client/web` | il client "serverless" non ha ancora supporto ORM; per Drizzle serve `@libsql/client/web` |
| **D1** | Binding nativo (`env.DB`), nessuna rete | è l'unico dei tre che non paga un round-trip HTTP verso un provider esterno |

### 3.3 Limiti e proprietà che decidono

**D1** (*D1 — Limits*, 2026-10-24; *Pricing*, 2026-10-02):

- 10 GB per database sul piano Paid, **non aumentabile**; 50.000 database per account, 1 TB per account. Il modello dichiarato è "molti database piccoli per tenant", non "un database grande".
- Ogni database è **single-threaded**: processa una query alla volta. Il throughput è `1 / durata query`. Con query da 1 ms si parla di ~1.000 query/s teoriche; con query da 100 ms, 10 query/s. Per Nando è irrilevante, ma spiega perché D1 non sia pensato per un monolite multi-utente.
- Limiti rigidi di riga: 2 MB per stringa/BLOB/riga, 100 colonne per tabella, 100 KB per statement, 100 parametri per query, 30 s per query, 1.000 query per invocazione Worker.
- Read replication disponibile, ma **solo attraverso la Sessions API**: senza sessione, tutti i read vanno al primary; con sessione si ottiene consistenza sequenziale tramite bookmark. Non è "replica trasparente".
- Free: 5 GB totali, 5M righe lette/giorno, 100k righe scritte/giorno. Paid: 25 miliardi di righe lette/mese incluse.

**Neon / Lakebase** (guide citate in Fonti):

- Driver HTTP: una `fetch` per query, **64 MB** massimi per richiesta e per risposta; transazioni non interattive con `sql.transaction([...])`.
- Pool/Client su WebSocket: su Workers la connessione **non può sopravvivere alla singola richiesta** — va aperta, usata e chiusa nel handler. Quindi: niente pool persistente lato Worker, il pooling lo fa Hyperdrive.
- Hyperdrive (consigliato): ~100 connessioni verso l'origine per configurazione sul piano Paid, timeout connessione 15 s, **query massima 60 s**, caching delle query più frequenti attivo di default (risposte cache fino a 50 MB).
- Scale-to-zero: il compute si sospende dopo 5 minuti di inattività e si riattiva "entro qualche centinaio di millisecondi". Su un'app personale usata a raffiche è un compromesso accettabile ma **percepibile**: la prima query dopo pausa è più lenta.

**Turso** (docs Turso Cloud, accesso 2026-10-26):

- SQLite-compatibile via HTTP pipeline; MVCC e `BEGIN CONCURRENT` disponibili per scritture concorrenti (con gestione dei conflitti a carico dell'applicazione). Di default resta un solo writer alla volta.
- Limiti dichiarati: `PRAGMA user_version` e `application_id` sono **read-only** (le migrazioni vanno tracciate in una tabella), `journal_mode` non è modificabile, `busy_timeout` ignorato, `VACUUM` disabilitato. Sono esattamente i punti su cui poggiano i tool di migrazione SQLite: vanno verificati prima di scegliere Drizzle + Turso.
- Billing a righe lette/scritte e storage, con blocchi (`BLOCKED`) al superamento delle quote del piano.

### 3.4 Come decidere (raccomandazione, non decisione)

- **Se il modello di dominio resta relazionale e ricco** (Knowledge con backlink, Habits con periodi e versioni, Relationships con identità multiple, ACL per scope), Postgres è la scelta che riduce il lavoro applicativo: join, vincoli, `jsonb`, full-text e `pgvector`, RLS come seconda barriera. Via Workers significa **Neon + Hyperdrive** (o qualunque Postgres + Hyperdrive).
- **Se si vuole il minimo di parti mobili e costo zero**, D1 è imbattibile sull'integrazione: binding nativo, nessun egress, backup Time Travel 30 giorni, 10 GB per database sono abbondanti per un utente singolo. Il prezzo è accettare SQLite (niente tipi ricchi, niente RLS, 2 MB per riga) e la natura single-threaded del database.
- **Turso** ha senso se si vuole SQLite *con* una storia di repliche e concorrenza, ma oggi introduce attrito su migrazioni (pragma read-only) e supporto ORM (driver serverless senza ORM). Per Nando è la terza opzione, non la prima.

**Nota trasversale:** qualunque sia il database, la latenza di un'app personale è dominata dalla distanza Workers↔database. D1 è dentro l'account Cloudflare; Neon/Turso aggiungono un hop HTTP. Hyperdrive mitiga il secondo caso, non lo elimina.

---

## 4. Job e reminder: Cron, Queues, Workflows, Durable Objects

Questa è la parte in cui la piattaforma impone la scelta architetturale più forte.

### 4.1 Cron Triggers

*Workers — Cron Triggers* (2026-10-17) e *Limits* (2026-10-12):

- **Solo UTC.** Cinque campi, sintassi Quartz-like. Nessun parametro di timezone: un reminder "alle 9:00 locali" richiede comunque un dispatcher che calcoli l'offset dell'utente.
- Granularità minima: 1 minuto. Non esiste "alle 9:03:17".
- 250 cron per account sul piano Paid (5 sul Free).
- Wall time massimo 15 minuti per invocazione; CPU 30 s con intervallo < 1 h, 15 min con intervallo ≥ 1 h.
- Le modifiche alla configurazione possono impiegare **fino a 15 minuti** per propagarsi.
- I Worker schedulati girano su macchine "sottoutilizzate": non c'è una garanzia contrattuale di puntualità al secondo, e la documentazione non la promette.

### 4.2 Queues

*Queues — Limits* e *Delivery guarantees* (2026-04-21):

- **Consegna at-least-once**: i duplicati sono possibili per progetto. La documentazione prescrive idempotency key sui consumer.
- Messaggio max 128 KB, batch max 100 messaggi, 100 retry, throughput 5.000 msg/s per coda, backlog 25 GB.
- Retention configurabile fino a 14 giorni (24 h fisse sul Free).
- **`delaySeconds` massimo 24 ore**: non è un meccanismo di reminder a lungo termine.
- Consumer: 15 minuti di wall time, 250 invocazioni concorrenti, CPU fino a 5 minuti.
- Dead letter queue disponibile per gli scarti definitivi.

### 4.3 Workflows

*Workflows — Limits* (2026-09-21) e *Pricing* (2026-10-02):

- Ogni step ha **wall time illimitato** (soggetto solo alla CPU: 30 s default, 5 min configurabili). Lo stato è durevole e i retry sono per step.
- `step.sleep` fino a **365 giorni**. Le istanze in `waiting` **non consumano slot di concorrenza**.
- Payload evento e risultato di step non-stream: **1 MiB**. Stato persistito per istanza: 1 GB. Output grandi → R2, e si restituisce un riferimento.
- 10.000 step di default (25.000 configurabili), 10.000 retry per step.
- Concorrenza: **50.000 istanze concorrenti per account** sul piano Paid secondo la tabella; la prosa della stessa pagina parla ancora di 10.000 — incoerenza documentale da trattare come "almeno 10.000".
- Retention dello stato completato: 30 giorni (Paid).
- I Workflow lanciati da `schedules` hanno un budget di 1 ora per firing senza consumare slot.
- Free: 100 istanze concorrenti, 3 giorni di retention, 3.000 step/giorno.

### 4.4 Durable Objects e Alarms

*DO — Limits* (2026-06-01) e *Alarms* (2026-04-21):

- **Un solo alarm per Durable Object** (`setAlarm` sovrascrive). Il pattern documentato per molti eventi: tenere lo schedule in storage, far processare all'`alarm()` gli eventi dovuti e ri-schedulare il prossimo.
- Esecuzione **at-least-once**, retry con backoff esponenziale da 2 s, **massimo 6 tentativi**. Oltre, l'alarm non viene più eseguito finché non lo si ri-schedula: per reminder critici va catturata l'eccezione e ri-schedulato esplicitamente.
- Handler alarm: 15 minuti di wall time. Un oggetto: soft limit ~1.000 req/s, 10 GB di storage SQLite, WebSocket message 32 MiB.
- DO disponibili anche su Free (solo storage SQLite).

### 4.5 Combinazione consigliata per i reminder di Nando

Tre pattern realistici, da scegliere in base alla latenza desiderata:

1. **Cron ogni minuto + query "due"** — un `scheduled` che ogni minuto seleziona i reminder scaduti (in UTC, confrontando timestamp assoluti già calcolati in fase di scrittura) e li accoda. Semplice, robusto, granularità 1 minuto, nessuno stato per-utente. Costo: 1.440 invocazioni/giorno.
2. **Durable Object alarm per utente** — un oggetto per persona/space con lo schedule in storage e ri-schedulazione nel handler. Più preciso del cron, ma richiede di gestire i 6 retry e la ri-schedulazione manuale.
3. **Workflow per reminder a lungo termine** — `step.sleep` fino a 365 giorni e passo finale che invia la notifica. Ideale per "tra 3 mesi ricordami di…", ma **non** per scheduling di massa: ogni istanza è un oggetto persistente, e la creazione è limitata a 300 istanze/s per account.

**Raccomandazione:** pattern 1 come spina dorsale (dispatcher idempotente ogni minuto) + pattern 3 per gli eventi a data lunga (compleanni, anniversari, follow-up di Relationships) + Queues per il fan-out delle notifiche. Il fuso orario è un problema *applicativo*: si salva sempre un istante assoluto, mai "09:00 locale".

---

## 5. File storage

*R2 — Limits* (2026-06-08) e *Pricing* (2026-10-02):

- Storage per bucket illimitato, oggetti illimitati, 1.000.000 bucket per account.
- Oggetto fino a 5 TiB; upload singolo fino a 5 GiB; 10.000 parti per multipart.
- **Una scrittura concorrente per chiave al secondo**: chiavi "hot" (es. un contatore o un file di stato) vanno evitate.
- Egress gratuito; Class A (write) e Class B (read) a consumo; 10 GB-month gratis.
- Binding Worker nativo, più API S3-compatibile per upload diretti dal browser.
- `r2.dev` non è per la produzione (rate limit variabile): serve un custom domain.

Vincolo d'integrazione: il body di una richiesta verso un Worker è limitato a 100 MB (Free/Pro). Per import di export WhatsApp o archivi grandi, il percorso corretto è **upload diretto a R2 con URL prefirmato**, non passaggio dal Worker.

**Raccomandazione:** R2 come unico storage binario (export chat, allegati Knowledge, immagini Relationships), con metadata e riferimenti nel database; mai byte nel DB.

---

## 6. Streaming e chiamate AI lunghe

### 6.1 Cosa è garantito

- **Streaming della risposta**: supportato e documentato. `ReadableStream`/`TransformStream`, `response.body.pipeTo(writable)` senza `await`, e la risposta parte prima che il body sia completo. Non c'è buffering obbligatorio, e non c'è limite al wall time finché il client è connesso.
- **SSE** è solo un `Response` con `Content-Type: text/event-stream` e un `ReadableStream` come body: rientra nel caso precedente.
- **La CPU non conta l'attesa del provider**: una chiamata a OpenAI/Anthropic che dura 40 s consuma CPU per il parsing dei chunk, non per l'attesa.
- **AI Gateway** è disponibile su tutti i piani e aggiunge, senza codice applicativo: analytics, logging, caching, rate limiting, retry e fallback tra modelli. È la risposta "piattaforma" al problema di affidabilità dei provider.

### 6.2 Cosa non è garantito

- **Se il client si disconnette, il lavoro viene cancellato.** Non c'è modo di "lasciar finire" la generazione oltre i 30 s di `waitUntil`. Una risposta SSE interrotta a metà non produce un piano salvato.
- **Nessun processo long-lived.** Non si tiene aperta una connessione al provider tra una richiesta e l'altra: ogni richiesta apre e chiude. Un agent loop che richiede 20 chiamate sequenziali è 20 subrequest nella stessa invocazione (limite 10.000, quindi ampio, ma con 6 connessioni in parallelo massime).
- **Nessun filesystem temporaneo affidabile** per scratch di generazione: si lavora in memoria (128 MB) o su R2.

### 6.3 Pattern raccomandato

| Caso | Meccanismo |
|---|---|
| Chat con l'utente, token in tempo reale | SSE dal Worker, `TransformStream`, AI Gateway davanti al provider |
| Generazione di un piano Learning, estrazione da export, batch di memorie | **Workflow**: `step.do` per la chiamata AI, output grande su R2, stato durevole, retry per step |
| Notifica a fine generazione | Workflow + coda/notifica; il client fa polling o riceve via WebSocket |
| Workflow che deve "vedere" l'utente | il Workflow scrive lo stato; la UI lo legge; nessun push garantito senza WebSocket/DO |

Il punto architetturale: **lo streaming è per l'UX, il Workflow è per la verità**. Nando ha bisogno di entrambi perché l'AI non deve applicare modifiche senza approvazione: la proposta generata deve sopravvivere alla disconnessione del client.

---

## 7. WebSocket

*Workers — WebSockets* (2026-10-12); *DO — Limits* (2026-06-01).

- I WebSocket client↔Worker funzionano (`WebSocketPair`, `accept`, `send`), con **32 MiB** massimi per messaggio in ingresso; oltre, chiusura con codice 1009.
- Per coordinare più connessioni serve un **Durable Object** come punto singolo: il Worker "liscio" non ha stato condiviso né affinity.
- **Le connessioni cadono al runtime update**: la finestra di grazia è fino a 20 minuti, poi il processo precedente termina. Un client deve riconnettersi e ripristinare lo stato.
- La WebSocket Hibernation API dei Durable Objects evita di pagare durata quando non ci sono messaggi; senza di essa un oggetto con WebSocket aperto paga wall time per tutta la connessione.

**Raccomandazione:** per Nando i WebSocket non sono necessari nella prima versione. Streaming SSE per l'AI, polling leggero o Realtime del database per gli aggiornamenti di stato. WebSocket solo se serve una UI "live" condivisa su più dispositivi, e in quel caso dentro un DO con hibernation.

---

## 8. Observability

*Workers Logs* (2026-10-12); *Pricing* (2026-10-02).

- **Workers Logs** è attivo di default sui nuovi Worker: invocation logs + `console.log`, query in dashboard, structured logging con indici sui campi JSON.
- Retention **7 giorni** (3 sul Free), 20M log inclusi/mese sul Paid, poi $0.60/M; **256 KB per log**, oltre viene troncato con flag `truncated`.
- Sampling head-based configurabile (`head_sampling_rate`) per contenere volume e costo.
- Export verso terzi: OpenTelemetry (raccomandato), Logpush, Tail Workers. Logpush è solo Paid.
- **Da dicembre 2026 la voce di prezzo cambia**: Workers Logs passa al listino Cloudflare Observability. Da riverificare al momento dell'acquisto.
- Non c'è tracing distribuito "gratis" delle query: D1 e Hyperdrive hanno metriche proprie, ma la correlazione request→query→LLM va costruita (log strutturato con `requestId`, oppure OTel).

**Raccomandazione:** osservabilità minima ma strutturata fin dall'inizio — log JSON con `requestId`, `module`, `entity`, `outcome`; campi indicizzati; niente `console.log` di oggetti interi con PII (rilevante per Relationships). Per l'AI, usare AI Gateway e non reinventare il logging dei token.

---

## 9. Cosa funziona oggi, cosa richiede workaround, cosa evitare

### Funziona oggi, senza attriti

- TanStack Start in SSR su Workers, con deploy via `wrangler` e binding tipizzati.
- Streaming SSE di risposte AI, con AI Gateway per retry/fallback/caching.
- D1 con binding nativo, Time Travel 30 giorni, 10 GB per database.
- Postgres su Neon via Hyperdrive, con driver nativo e pooling gestito.
- R2 per binari, con egress gratuito e upload prefirmati.
- Cron Trigger ogni minuto, Queues con retry e DLQ, Workflows con `step.sleep` fino a 365 giorni.
- Workers Logs con query strutturate e export OTel.

### Richiede workaround (o disciplina)

- **Reminder timezone-aware**: cron è UTC-only → salvare istanti assoluti e usare un dispatcher; il calcolo del fuso è applicativo.
- **Reminder oltre 24 h**: `delaySeconds` di Queues non basta → Workflows (`step.sleep`) o DO alarms.
- **Job AI > 30 s dopo la risposta**: `waitUntil` non basta → Workflow o coda.
- **WebSocket**: serve un DO per la coordinazione, e il client deve tollerare disconnessioni da deploy/runtime update.
- **Query > 60 s** su Postgres via Hyperdrive: terminate. Le migrazioni pesanti vanno fatte fuori dal Worker (o a batch).
- **Upload > 100 MB**: non passare dal Worker, usare R2 diretto.
- **Fan-out > 6 chiamate parallele**: il runtime accoda; va progettato un limite di concorrenza esplicito.
- **Migrazioni su Turso**: `user_version` read-only, `VACUUM` disabilitato → il tooling standard va adattato.

### Da evitare

- Contare su `setTimeout`/stato in memoria per reminder o job differiti: l'isolate può essere riciclato in qualsiasi momento.
- Mettere binari o blob grandi nel database (2 MB per riga su D1, 64 MB per risposta sul driver HTTP Neon).
- Un database D1 "grande" come se fosse Postgres: 10 GB non aumentabili, single-threaded, 100 colonne per tabella.
- WebSocket aperti su un Worker senza DO e senza piano di riconnessione.
- Dipendere da un adapter Nitro/Rsbuild per TanStack Start su Workers: la via supportata è Vite + plugin Cloudflare.
- Loggare payload di chat o memorie Romantic nei log (retention 7 giorni, export verso terzi) senza redazione.

---

## 10. Implicazioni per Nando (raccomandazioni, non decisioni)

1. **Un solo Worker** con TanStack Start (SSR) + static assets; handler aggiuntivi (`scheduled`, `queue`) nello stesso entrypoint custom. Il modular monolith resta intatto: i moduli sono cartelle, non deploy.
2. **Piano Workers Paid** come baseline: il Free (10 ms CPU, 100k richieste/giorno) non regge SSR + uso quotidiano.
3. **Database**: se il dominio resta ricco e relazionale → Postgres (Neon/Lakebase) via Hyperdrive. Se si privilegia semplicità e costo → D1. Turso solo se si vuole esplicitamente SQLite con repliche. La decisione va presa insieme al modello dati di Knowledge/Habits, non prima.
4. **Reminder**: tabella `Reminder` con istante assoluto + timezone dell'utente come metadata; cron ogni minuto che reclama i dovuti con una `idempotency key`; Workflow per gli orizzonti lunghi; Queues per la consegna.
5. **AI**: streaming SSE per la conversazione; Workflow per generazioni che devono sopravvivere alla chiusura del tab; AI Gateway per retry/fallback e per non costruire observability dei token da zero.
6. **File**: R2 per export WhatsApp, allegati, immagini; upload diretto con URL prefirmato; metadata nel DB.
7. **Privacy**: l'isolamento per scope (Romantic vs Professional) resta applicativo. Se il DB è Postgres, RLS può fare da seconda barriera; su SQLite non esiste e va imposto nel codice.
8. **Observability**: log JSON strutturati con `requestId` e `module`, redazione delle PII, export OTel quando servirà.

---

## Sintesi per il ticket

- **Runtime**: CPU 10 ms (Free) / 5 min (Paid, default 30 s); memoria 128 MB per isolate; **nessun limite di durata** per le richieste HTTP finché il client è connesso; 6 connessioni in attesa di header; 10.000 subrequest (Paid).
- **SSR su Workers è viable ma non gratis**: 10–20 ms di CPU tipici per SSR rendono il piano Free strutturalmente inadeguato; il Paid da $5/mese è la baseline.
- **TanStack Start è supportato ufficialmente** da Cloudflare e TanStack, ma **solo via Vite** (Rsbuild non supportato) e con entrypoint custom per Queue/Cron/Workflow/DO.
- **D1**: 10 GB per database non aumentabili, single-threaded per database, 2 MB per riga, read replication solo via Sessions API (consistenza sequenziale). Ottimo per un utente singolo, non per un monolite multi-tenant.
- **Neon**: oggi è **Lakebase Postgres (Databricks)**; Neon consiglia **Hyperdrive** (pooling, caching, query max 60 s) al posto del driver HTTP; scale-to-zero dopo 5 minuti con riattivazione in qualche centinaio di ms.
- **Turso**: SQL over HTTP funziona, ma `user_version`/`application_id` sono read-only, `VACUUM` è disabilitato e il driver "serverless" non supporta ancora gli ORM: attrito su migrazioni e tooling.
- **Reminder**: i Cron sono **UTC-only** con granularità al minuto e fino a 15 minuti di propagazione → serve un dispatcher che salvi istanti assoluti, non orari locali.
- **Queues** sono at-least-once (servono idempotency key, cosa che Nando già richiede per le evidenze Habits) e con `delaySeconds` max **24 h**: non sono un scheduler di lungo periodo.
- **Workflows** sono l'unico meccanismo nativo per attese fino a **365 giorni** con stato durevole, retry per step e wall time illimitato per step; output max 1 MiB per step → binari su R2.
- **Streaming AI**: SSE funziona senza limiti di durata, ma **la disconnessione del client cancella il lavoro** (`waitUntil` copre solo 30 s): chat in streaming, generazioni lunghe in Workflow.
- **WebSocket**: supportati (32 MiB per messaggio) ma richiedono un Durable Object per la coordinazione e cadono ai runtime update (grazia fino a 20 min).
- **Storage e observability**: R2 è la scelta ovvia per i binari (egress gratuito, upload diretto); Workers Logs dà 7 giorni di retention, 256 KB per log ed export OTel, con **cambio di listino dal 2026-12-01** da riverificare.

---

## Fonti

Tutte le URL sono state consultate il **2026-10-26**. Per ogni pagina è indicata la data di ultimo aggiornamento dichiarata dal sito.

**Cloudflare Workers**

1. Workers — Limits (agg. 2026-10-12) — https://developers.cloudflare.com/workers/platform/limits/
2. Workers — Pricing (agg. 2026-10-02) — https://developers.cloudflare.com/workers/platform/pricing/
3. Workers — Cron Triggers (agg. 2026-10-17) — https://developers.cloudflare.com/workers/configuration/cron-triggers/
4. Workers — Streams (agg. 2026-06-15) — https://developers.cloudflare.com/workers/runtime-apis/streams/
5. Workers — WebSockets (agg. 2026-10-12) — https://developers.cloudflare.com/workers/runtime-apis/websockets/
6. Workers — Node.js compatibility (agg. 2026-08-12) — https://developers.cloudflare.com/workers/runtime-apis/nodejs/
7. Workers — TanStack Start (agg. 2026-10-13) — https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
8. Workers — Workers Logs (agg. 2026-10-12) — https://developers.cloudflare.com/workers/observability/logs/workers-logs/

**Cloudflare — dati, job, storage**

9. D1 — Limits (agg. 2026-10-24) — https://developers.cloudflare.com/d1/platform/limits/
10. D1 — Global read replication (agg. 2026-08-10) — https://developers.cloudflare.com/d1/best-practices/read-replication/
11. Queues — Limits (agg. 2026-04-21) — https://developers.cloudflare.com/queues/platform/limits/
12. Queues — Delivery guarantees (agg. 2026-04-21) — https://developers.cloudflare.com/queues/reference/delivery-guarantees/
13. Workflows — Limits (agg. 2026-09-21) — https://developers.cloudflare.com/workflows/reference/limits/
14. Durable Objects — Limits (agg. 2026-06-01) — https://developers.cloudflare.com/durable-objects/platform/limits/
15. Durable Objects — Alarms (agg. 2026-04-21) — https://developers.cloudflare.com/durable-objects/api/alarms/
16. R2 — Limits (agg. 2026-06-08) — https://developers.cloudflare.com/r2/platform/limits/
17. Hyperdrive — overview (agg. 2026-10-21) — https://developers.cloudflare.com/hyperdrive/
18. Hyperdrive — Limits (agg. 2026-06-09) — https://developers.cloudflare.com/hyperdrive/platform/limits/
19. AI Gateway — overview (agg. 2026-04-20) — https://developers.cloudflare.com/ai-gateway/

**Framework**

20. TanStack Start — Hosting (consultata 2026-10-26) — https://tanstack.com/start/latest/docs/framework/react/guide/hosting

**Database**

21. Neon — Use Neon with Cloudflare Workers (consultata 2026-10-26) — https://neon.com/docs/guides/cloudflare-workers
22. Neon — Serverless driver (consultata 2026-10-26) — https://neon.com/docs/serverless/serverless-driver
23. Neon — Scale to Zero (consultata 2026-10-26) — https://neon.com/docs/introduction/scale-to-zero
24. Neon — Documentation index / posizionamento "Lakebase Postgres, from Databricks" (consultata 2026-10-26) — https://neon.com/docs/llms.txt
25. Neon — Row-Level Security guide (indice, consultata 2026-10-26) — https://neon.com/docs/guides/row-level-security
26. Turso — SQL over HTTP quickstart (consultata 2026-10-26) — https://docs.turso.tech/sdk/http/quickstart
27. Turso — Limitations (consultata 2026-10-26) — https://docs.turso.tech/cloud/limitations
28. Turso — Concurrent writes / MVCC (consultata 2026-10-26) — https://docs.turso.tech/tursodb/concurrent-writes
29. Turso — Usage & billing (consultata 2026-10-26) — https://docs.turso.tech/help/usage-and-billing

---

## Note di affidabilità delle fonti

- **Workflows, concorrenza**: la tabella dei limiti indica 50.000 istanze concorrenti (Paid), la prosa della stessa pagina cita 10.000. Trattare il valore come "≥ 10.000, verificare in dashboard prima di dimensionare".
- **Cron per Worker**: la pagina *Durable Objects — Alarms* afferma "un Worker può avere fino a tre Cron Triggers", mentre *Workers — Limits* indica 250 per account (Paid). Vale il secondo; il primo è testo legacy.
- **AI Gateway / Workers AI**: le pagine di feature cambiano URL frequentemente; il riferimento stabile è la overview AI Gateway. Le funzionalità citate (caching, rate limiting, retry/fallback, logging) sono elencate lì.
- **Prezzi**: Workers Logs cambia listino dal 2026-12-01; i valori di questa ricerca valgono fino a quella data.
