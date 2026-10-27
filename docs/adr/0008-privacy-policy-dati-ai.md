# 0008 — Privacy e policy dei dati per l'AI

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-56 — Scope e privacy dei dati per l'AI
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Anche con un solo utente, i dati hanno contesti e sensibilità. L'ADR-0007 ha fissato gli hook — `scope`, `policySnapshot`, ModelRegistry, query tool e proposal tool — ma non ha deciso cosa l'AI può leggere, cosa esce verso un provider esterno, cosa resta fuori dal retrieval e come si revoca un'autorizzazione. Il requisito è che la policy sia applicata **prima del retrieval**, non solo nascosta in UI.

La mappa fissa API esterne di default e modelli locali come opzione futura. La ricerca NAS-42 mostra che training, retention e residenza sono attributi separati: non esiste un unico "provider fidato". Questo ticket separa due livelli:

- **hard**: ciò che Nando non lascia mai passare — Scope, dati `restricted`, grant;
- **advisory**: ciò che l'utente deve vedere e confermare — sensibilità `sensitive`, attributi del provider, scelta del modello.

L'utente ha scelto di non usare residenza, no-training o zero-retention come filtro hard. L'unico divieto di dato è `restricted`; il resto è trasparenza e scelta informata. Questo modifica ADR-0007 in più punti — free tier, selezione del modello, fallback e altri — elencati in "Modifica ad ADR-0007".

## Decisione

### Principio

La privacy non dipende da una promessa del provider, ma dal **confine dei dati**. Per questo il modello ha due livelli:

- **Hard**: Scope, `restricted`, grant. Violarli blocca la lettura o l'effetto; nessun override di conversazione.
- **Advisory**: `sensitive`, trust del provider, modello. Non bloccano; producono un banner, un ack esplicito e una traccia nel `policySnapshot`.

Un modello non conforme è usabile. Un dato fuori Scope o `restricted` no.

### Scope

- **Scope** = insieme di **Space root** (discendenti inclusi) + **grant espliciti** su singole entità. Niente deny rule: il single-user non ne ha bisogno.
- Lo Scope è **versionato**: ogni versione ha uno `scopeVersion`; ogni turno registra la versione usata. Un turno passato non viene reinterpretato con lo Scope nuovo.
- L'AI non può allargare lo Scope. L'utente sì, con un'azione esplicita che crea una nuova versione.
- Per leggere, un'entità deve appartenere a uno Space root nello Scope, oppure avere un grant esplicito, oppure essere **core-global** (sotto).
- Per scrivere, il target di un `ProposalEffect` deve essere nello Scope. Un `EntityRef` cross-Space non trasferisce il permesso di leggere o scrivere l'altro Space.
- **Archivio** escluso dal retrieval salvo grant esplicito; **deletion e tombstone** sempre esclusi dal retrieval attivo; i riferimenti restano storici ma non leggibili.
- **Core-global**: `Person` (solo `displayName`), `Notification` (solo tipo, conteggio, link, timestamp; niente titolo o corpo) e `Inbox` sono leggibili in ogni Scope. Restano soggetti a `restricted` e, se hanno una Source, al grant `ai` della Source. Il link di una Notification non è un grant: l'AI non può seguirlo fuori Scope.
- **Scope di default**: chat aperta dentro uno Space → quello Space e i discendenti; chat globale/dashboard → tutti gli Space con grant `ai`, esclusi i dati `restricted`, con conferma al primo uso.
- **Isolamento dei contesti**: `Context` non è un ACL (glossario: significato, non permesso). Un contesto privato si isola partizionando lo Scope (Space dedicato) o marcando il dato `restricted`; non si aggiunge un secondo asse di permesso.

### Sensibilità

Tre livelli ordinati, per entità:

- `personal` — default per il dominio.
- `sensitive` — etichetta per UI e trasparenza; in v1 non cambia provider, retrieval o retention. Potrà guidare default più stretti in futuro.
- `restricted` — unico divieto hard: non esce da Nando, non è leggibile dall'AI.

Assegnazione:

- Default per tipo/capability + default di Space; override per entità; effettiva = override, altrimenti il più restrittivo tra tipo e Space.
- Un `Block` può solo alzare la sensibilità rispetto al documento; non può abbassarla.
- L'AI non modifica la sensitivity: può solo suggerirne l'aumento. L'utente può cambiarla — è una modifica dell'entità, non un override di policy. Finché un dato è `restricted`, nessuna conversazione lo rende leggibile.
- Default: Tasks, Calendar, Notifications, Person, Knowledge e Habits = `personal`; import da terzi = `restricted` finché non approvati, poi `personal` e l'utente alza.
- Nessun tag libero in v1.

### Grant e revoca

Tre autorizzazioni per **Source**, indipendenti:

- `ingest` — la Source può portare nuovi dati in Nando.
- `ai` — i dati della Source possono essere letti dall'AI e inviati al modello scelto.
- `retain` — il testo grezzo e gli artefatti derivati possono essere conservati e riusati.

Regole:

- Default di Space; override esplicito per Source in entrambe le direzioni; la revoca di Space è una revoca di massa che vince sulle Source.
- `ai` revocato: stop immediato al retrieval futuro e ai turni in corso; gli effetti già applicati restano; le Proposal non accettate scadono; gli embedding derivati vengono eliminati.
- `retain` revocato: purge di testo grezzo e artefatti derivati; i fatti già approvati restano dominio e seguono la policy della loro entità; la Provenance segnala la Source revocata.
- `ingest` revocato: stop ai nuovi dati; lo storico resta.
- Una Source revocata non viene cancellata: il lifecycle è esplicito e la Provenance resta interrogabile.

### PolicyEngine e applicazione

- Un **PolicyEngine** nel core compila una **`PolicyDecision`** immutabile per turno: Space root ammessi, grant entitari, versione di Scope e grant, modello scelto, attributi di trust, ack, retention.
- La decisione viaggia come parametro esplicito nelle chiamate; non vive nel prompt né in stato globale.
- Applicazione in tre punti:
  1. **Retrieval**: il filtro è nella query, prima di leggere e prima di generare embedding. Un'entità fuori Scope o `restricted` non viene restituita.
  2. **Orchestrator**: rivalida ogni `EntityRef` restituito e ogni target degli effetti; un tool non può restituire un ref fuori decisione.
  3. **Catalogo modelli**: espone capability e attributi di trust; non filtra per trust (advisory), ma non permette un modello che non supporta le capability richieste.
- **Fail closed** su Scope e `restricted`: la lettura non avviene; il tool restituisce un errore di policy; il modello può correggere entro il limite di iterazioni. Un gap advisory non fa fallire il turno: produce banner e richiede ack.
- Un riferimento a `restricted` viene **omesso** dal DTO; il tool dichiara che esiste contenuto non disponibile, senza rivelarne il contenuto; la UI mostra un avviso. Il modello non deve inferire il contenuto mancante.

### Retrieval

- **Unità minima**: il retrieval restituisce chunk/`Block` e DTO con i soli campi richiesti dal tool. Il documento intero si legge solo con un tool esplicito e un `contextRef` dedicato.
- I **payload** delle entità lette non vengono salvati nei `Message`; restano nei `contextRefs` come riferimenti.
- **Context** ordina la rilevanza; non è un permesso. Un contesto privato è Scope o `restricted`, non un ACL.
- **Nessuna memoria automatica** dalle conversazioni passate: la cronologia serve alla continuità del thread. L'utente può citare esplicitamente una conversazione passata; la citazione è un grant e la sensitivity della conversazione citata si eredita.
- **Archivio, deletion, tombstone**: archivio escluso salvo grant; deletion e tombstone sempre esclusi; i riferimenti restano storici.
- **Core-global** come sopra: Person `displayName`, Notification metadata, Inbox.

### Artefatti AI

- `Conversation` e `Message` sono del modulo AI; non sono dominio.
- **Sensitivity della Conversation** = massimo dei `contextRef` effettivamente letti. Un `restricted` omesso non la alza.
- **Embedding**: se e quando NAS-59 introduce il retrieval semantico, ereditano la sensitivity dell'entità, non esistono per `restricted`, vengono eliminati con l'entità o con la revoca `ai`, e si rigenerano se cambia il modello.
- **Retention**: default 90 giorni per il contenuto di Conversation/Message; le Proposal applicate restano audit; gli embedding seguono il lifecycle dell'entità; la cancellazione manuale è sempre disponibile. La retention esatta è di NAS-47; questo ADR fissa il default e il principio.
- Una Proposal cita `conversationId`/`messageId`; se la conversazione viene cancellata, il riferimento è tombstoned e la Proposal resta.

### Modello e provider

- **L'utente sceglie il modello**: default nelle impostazioni, cambio per conversazione. Il ModelRegistry è un catalogo di capability e attributi di trust; non sceglie e non fa fallback.
- **Nessun fallback automatico**: se il provider fallisce, il turno si ferma con un errore; l'utente sceglie un altro modello.
- **Attributi di trust**: training sui dati, retention, residenza, human review, free tier. Sono mostrati, non filtrati.
- **Modello non conforme**: al primo invio compare un banner con i gap specifici; la conferma vale per la conversazione, si rinnova al cambio modello e all'allargamento dello Scope. L'ack (testo mostrato, timestamp, modello) va nel `policySnapshot`.
- **Free tier**: ammesso, stesso banner degli altri modelli non conformi. Nessuna esclusione hard.
- **Ingressi**: provider diretti, Cloudflare AI Gateway e OpenRouter. La UI mostra la catena e i gap di ogni anello; il gateway è trasporto, non trust boundary. I log del gateway sono disattivati di default.
- **Residenza**: non è un vincolo. È un attributo mostrato.

### Trasparenza

- Pannello **"Dati usati"** per conversazione e per Proposal: modello, provider chain, attributi di trust e gap, `policySnapshot`, `contextRefs`, sensitivity, `scopeVersion`, `grantVersion`, timestamp, ack.
- La Proposal mantiene il "Perché" e i `contextRefs` (ADR-0007).
- **Nessun audit log globale** in v1: il pannello è la superficie di ispezione.
- **Log applicativi**: solo metadata (modello, provider, token, latenza, esito, policySnapshot); mai prompt, contenuti o `contextRefs` in chiaro. I log del gateway sono off di default.

## Schema concettuale

```text
Scope
  id, version, spaceRoots[], entityGrants[]

SourceGrant
  sourceId, ingest, ai, retain, updatedAt

Sensitivity
  personal | sensitive | restricted

PolicyDecision
  id, scopeVersion, grantVersion,
  spaceRoots[], entityGrants[],
  modelId, providerChain[], trustGaps[],
  ack?, retention

Conversation
  ... (ADR-0007)
  scopeVersion, sensitivity

Message
  ... (ADR-0007)
  policySnapshot?

Proposal
  ... (ADR-0007)
  policySnapshot:
    providerChain, model, trustGaps, ack,
    scopeVersion, grantVersion, sensitivity, capturedAt
```

## Invarianti

1. Lo Scope è l'unico confine di lettura; `Context` non è un permesso.
2. `restricted` non esce da Nando e non è leggibile dall'AI; nessun override di conversazione.
3. Un `EntityRef` cross-Space non trasferisce il permesso.
4. L'AI non allarga lo Scope, non cambia la sensitivity, non cambia i grant.
5. La `PolicyDecision` è compilata prima del retrieval e applicata nella query; nessun tool legge fuori decisione.
6. Fail closed su Scope e `restricted`; i gap advisory producono banner e ack, non silenzio.
7. Il modello è scelto dall'utente; nessun fallback automatico; nessun invio a un modello non conforme senza ack.
8. `policySnapshot` registra modello, provider chain, gap, ack, `scopeVersion`, `grantVersion`, sensitivity.
9. `retain` revocato non cancella i fatti approvati; `ai` revocato ferma il futuro, non riscrive il passato.
10. Le conversazioni non sono memoria automatica; si citano esplicitamente.
11. Notification è metadata, non contenuto; Person è `displayName`; Inbox è globale; nessun contenuto di altri Space.
12. I log non contengono contenuti.

## Conseguenze

- **NAS-47**: tabelle e colonne per `Scope`/versione, `SourceGrant`, `sensitivity` su entità e Block, `policySnapshot` su Message/Proposal; retention 90 giorni; purge degli embedding; tombstone; export.
- **NAS-51**: ModelRegistry come catalogo, adapter AiPort, provider chain, gateway con log off, nessun fallback automatico; logging metadata-only.
- **NAS-59**: retrieval su Block/chunk, `contextRefs`, embedding con sensitivity, niente embedding per `restricted`, citazione esplicita di una conversazione passata.
- **NAS-54**: Block con sensitivity override solo verso l'alto.
- **NAS-62**: pannello "Dati usati", indicatore di Scope, model picker con gap di trust.
- **NAS-53**: la roadmap include il modello di policy e i suoi hard boundary.
- **NAS-58 / ADR-0007**: modificato come sotto; il resto del contratto (Proposal, effetti, idempotenza, provenienza, sicurezza) resta valido.

## Modifica ad ADR-0007

Questo ADR **modifica** i seguenti punti di ADR-0007:

1. **Free tier**: non è più vietato. È un modello non conforme come gli altri, con lo stesso banner e la stessa conferma per conversazione.
2. **ModelRegistry**: non sceglie il modello e non fa fallback. È un catalogo di capability e attributi di trust; la scelta è dell'utente, con default nelle impostazioni.
3. **Fallback**: "solo verso un modello con policy compatibile" diventa "nessun fallback automatico". Se il provider fallisce, il turno si ferma e l'utente sceglie.
4. **Override**: "rifiutato o mostrato con un avviso" diventa "banner con i gap + conferma per conversazione"; l'ack è registrato nel `policySnapshot`.
5. **`policySnapshot`**: cresce con `providerChain`, `trustGaps`, `ack`, `scopeVersion`, `grantVersion`, `sensitivity`.
6. **Sensitivity del provider**: `sensitive` non è più un vincolo di model selection; l'unico hard è `restricted`.
7. **Core-global e Notification**: Person solo `displayName`, Notification solo metadata, Inbox globale in ogni Scope.
8. **Retention, memoria, log**: 90 giorni per le conversazioni, nessuna memoria automatica, log metadata-only.

Il resto di ADR-0007 — tool di query/proposta, Proposal, effetti ordinati, idempotenza, un aggregate per transazione, provenienza, notifiche `ai.proposalPending`, sicurezza — resta invariato.

## Alternative scartate

- **Residenza EU hard**: l'utente ha scelto di non vincolare la residenza; per un single-user non vale il costo di approvazioni e provider ristretti.
- **Baseline no-training/zero-retention come filtro**: advisory + banner; l'utente può usare qualsiasi modello, con ack.
- **Free tier vietato**: stesso banner degli altri; nessuna eccezione hard.
- **ModelRegistry che sceglie e fa fallback**: la scelta è dell'utente; niente switch silenziosi.
- **Sensitivity come ACL**: `sensitive` è un'etichetta; l'unico hard è `restricted`.
- **Context come secondo ACL**: il glossario lo esclude; l'isolamento è Scope o `restricted`.
- **Scope = set di EntityRef**: costoso e senza confine naturale.
- **Scope = tutto il workspace**: non è un confine.
- **Un solo grant per Source**: `ingest`, `ai` e `retain` sono indipendenti.
- **Policy solo per Space**: manca il controllo per Source.
- **Memoria automatica delle conversazioni**: aumenta la superficie; citazione esplicita.
- **Audit log globale**: il pannello "Dati usati" basta in v1.
- **Log dei prompt**: metadata only.
- **Retrieval di entità intere**: chunk + DTO minimi.
- **Notifiche con corpo**: leak cross-Space; metadata only.
- **Person globale completo**: solo `displayName`.
- **Fallback locale per `restricted`**: non in v1; `restricted` resta fuori dall'AI finché non esiste un modello locale.
