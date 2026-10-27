# 0007 — AI supervisionata: tool, proposte e applicazione

- **Stato:** accettato; modificato in parte da ADR-0008 (privacy e policy dei dati per l'AI)
- **Data:** 2026-10-27
- **Ticket:** NAS-58 — AI: orchestrazione, proposte, approvazione
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Il handoff fissa il principio: l'AI assiste, suggerisce, estrae e costruisce piani, ma le modifiche strutturali richiedono approvazione; non deve presumere che un'inferenza sia un fatto. L'input di design separa il dominio Nando dal trasporto: `AiPort`, `ModelRegistry` e `ProposalLifecycle` sono nostri; TanStack AI è un adapter. OpenCode Go è un adapter opzionale, non la fondazione; i modelli free-tier non sono ammessi sui dati personali.

Serve un contratto unico che valga per Tasks, Habits, Knowledge e i moduli futuri, e che regga il caso multi-modulo: “crea il task e collegalo all'habit” deve essere una Proposal con effetti ordinati, non due scritture invisibili.

## Decisione

### Confini

- **AiPort**: trasporto verso il modello. `streamChat` restituisce delta di testo, tool call e metadati; non esegue tool e non applica nulla. Gli adapter (TanStack AI, OpenAI, Anthropic, Go, locale) implementano la porta. `embed` resta una porta separata per la ricerca semantica e non entra nel ciclo di proposta.
- **ModelRegistry**: dati per modello — provider, capability, context window, costo, retention, residency, sensitivity massima, stato. Sceglie il modello e produce uno snapshot di policy.
- **ToolRegistry**: catalogo dei tool dei moduli, filtrato per Scope e capability attive.
- **Orchestrator**: ciclo conversazione-tool; valida, raccoglie gli effetti e crea la Proposal.
- **ProposalService**: lifecycle, approvazione, applicazione per effetto, retry.
- **Conversation/Message**: storico AI persistito, posseduto dal modulo AI; non è una fonte di verità di dominio.

Il tool approval dell'SDK non è la fonte di verità: l'approvazione è di Nando.

### Tool

Due famiglie, nessuna scrittura diretta:

- **Query tool**: leggono entro lo Scope, non hanno effetti. Restituiscono un DTO con `EntityRef` e `version` per le precondizioni.
- **Proposal tool**: non applicano. Creano un `ProposalEffect` tipizzato; restituiscono `{ effectId, entityId?, localRef? }`. Un effetto di creazione prenota un `entityId` UUID e può avere un `localRef` simbolico che gli effetti successivi usano al posto dell'ID.

- Ogni modulo registra i propri tool; lo schema è derivato dal comando o dalla query del modulo, non duplicato a mano.
- Il catalogo è versionato; l'effetto registra la versione dello schema.
- L'orchestrator espone solo i tool consentiti dallo Scope e dalle capability attive. Nessun tool di `apply`, `execute` o scrittura diretta esiste nel catalogo.
- Le descrizioni dei tool sono in inglese tecnico; i testi utente sono in italiano.
- Il modulo fornisce la `displayLabel` leggibile dell'effetto; il modello fornisce la spiegazione.

### Orchestrazione

1. Il client invia un messaggio; l'orchestrator costruisce la conversazione e il catalogo.
2. Il modello può chiamare query tool, che vengono eseguiti subito e restituiti come dati.
3. Le chiamate ai proposal tool vengono raccolte; ogni chiamata restituisce un effetto con `effectId`, eventuale `entityId` e `localRef`.
4. Alla fine del turno, se ci sono effetti, l'orchestrator valida schema, Scope, precondizioni e riferimenti, poi crea una **Proposal** unica.
5. Se la validazione fallisce, il modello riceve l'errore e può correggere entro un limite di iterazioni; oltre, il turno fallisce senza Proposal.
6. Un turno senza effetti produce solo testo: può contenere Suggestion, ma non è una Proposal.

Limite configurabile, default 8 chiamate tool per turno. Le query sono sempre permesse; le proposal chiudono il turno quando l'orchestrator crea la Proposal. Ogni turno con effetti crea una nuova Proposal: non si modifica una Proposal esistente.

Se la generazione deve sopravvivere alla disconnessione del client, gira in un Workflow; lo streaming è UX (NAS-51).

### Proposal ed effetti

```text
Proposal
  id, title, summary, status, applicationStatus
  model, policySnapshot, conversationId?, messageId?, scope
  contextRefs[], selectedEffectIds[], effects[]
  createdAt, seenAt?, acceptedAt?, dismissedAt?, snoozedUntil?, expiredAt?
  usage?

ProposalEffect
  id, module, command, schemaVersion, displayLabel
  payload, localRef?, entityId?, targetRef?, expectedVersion?
  explanation, status, error?, resultRef?, attempts
```

- **Stati Proposal**: `proposed | seen | accepted | dismissed | snoozed | expired`.
- **Application status**: `not_started | running | partial | succeeded | failed`.
- **Stato effetto**: `pending | applied | failed | skipped`.

Transizioni:

- `proposed` → `seen` quando l'utente apre il dettaglio; `seen` non è obbligatorio.
- `proposed | seen` → `accepted`, `dismissed`, `snoozed`, `expired`.
- `snoozed` → `proposed` quando scade `snoozedUntil`. Preset: 1 ora, domani, prossima settimana; default domani.
- `expired` è terminale: le precondizioni non valgono più; si rigenera con una nuova Proposal.
- `accepted` è terminale per l'approvazione; l'esecuzione vive in `applicationStatus`.
- L'utente seleziona un sottoinsieme di effetti; gli altri diventano `skipped`. Nessun editing inline: per cambiare si chiede una nuova Proposal.
- Se un effetto fallisce durante l'applicazione, gli altri continuano. Non c'è rollback. L'utente può riprovare il singolo effetto; se è `stale`, serve una nuova Proposal.

### Ordine, riferimenti e precondizioni

- Gli effetti si applicano nell'ordine della Proposal.
- Un effetto di creazione può avere un `localRef` unico nella Proposal. Gli effetti successivi lo usano nelle posizioni `EntityRef`; l'orchestrator lo risolve nell'`entityId` pre-allocato. Un riferimento a un effetto successivo o mancante invalida la Proposal.
- Se un effetto fallisce, gli effetti successivi che dipendono dal suo `entityId` falliscono con `dependency_failed`; gli altri proseguono.
- Per update e delete la `expectedVersion` è obbligatoria; l'orchestrator la ricava dal query tool che ha letto l'entità nello stesso turno, altrimenti l'effetto è invalido.
- Le precondizioni vengono controllate all'accettazione e di nuovo all'applicazione. Prima dell'accettazione un fallimento rende la Proposal `expired`; dopo, l'effetto fallisce con `stale`.

### Applicazione

- Un effetto = un comando del modulo proprietario, con `commandKey = proposal:{proposalId}:effect:{effectId}:attempt:{n}`. Idempotente.
- Un aggregate per transazione: la Proposal aggiorna il proprio stato; il modulo scrive il proprio aggregate e il proprio outbox (ADR-0003). Nessuna transazione cross-module.
- `applicationStatus` è `running` durante l'applicazione, poi `succeeded`, `partial` o `failed`.
- `resultRef` punta all'entità creata o aggiornata; la UI collega il risultato.
- Un retry usa un nuovo `attempt` e la stessa `effectId`; l'idempotenza del comando evita doppie scritture.
- Un effetto `skipped` non viene applicato e non contribuisce a `partial`.

### Provenienza e spiegazione

- La Proposal salva `contextRefs`: le entità lette dai query tool, non il prompt integrale.
- Salva `model` e `policySnapshot` (provider, modello, retention, residency, sensitivity massima, data di cattura).
- Ogni effetto ha una `explanation` breve in italiano, scritta dal modello. La UI la mostra come “Perché”, insieme ai `contextRefs` e al modello.
- La spiegazione non è validata per verità: è un testo generato. La validazione riguarda schema, Scope, precondizioni e riferimenti.
- La conversazione può essere cancellata; le Proposal applicate restano come audit, con il riferimento alla conversazione tombstoned.

### Conversazione

- `Conversation` e `Message` sono entità del modulo AI, non del dominio. La chat è riprendibile; la Proposal cita `conversationId` e `messageId`.
- Il messaggio conserva ruolo, contenuto, tool call e metadati di modello/usage; non duplica i payload delle entità lette.
- L'utente può cancellare una conversazione; la retention è un parametro di NAS-47.
- La conversazione non è una fonte di verità: task, note e habit vivono nei loro moduli.

### Modello e policy

- `ModelRegistry` sceglie per capability richieste (tool calling, structured output, streaming), sensibilità del contesto, costo, disponibilità e preferenza utente.
- Il fallback è ammesso solo verso un modello con policy di retention/residency/sensitivity compatibile. Se non esiste, l'orchestrator fallisce con un errore chiaro; nessun downgrade silenzioso.
- L'utente può fare override per conversazione o nelle impostazioni; l'override che viola la policy viene rifiutato o mostrato con un avviso esplicito.
- La Proposal registra il modello effettivo e lo snapshot di policy. Se il fallback cambia modello, cambia anche lo snapshot.
- Provider-agnostico: cambiare adapter non cambia Proposal, approvazione o applicazione.

### Cosa può fare l'AI senza conferma

- Leggere con i query tool entro lo Scope.
- Riassumere, spiegare, ragionare e produrre testo in chat.
- Preparare bozze di testo che non vengono persistite.
- Creare una Proposal, che non applica nulla.
- Scrivere artefatti AI interni (messaggi, usage, embedding) secondo la policy.

Non può:

- Scrivere dati di dominio, applicare effetti o approvare le proprie Proposal.
- Cambiare Scope, permessi o impostazioni.
- Cancellare, archiviare o eliminare entità.
- Avere side effect esterni (email, calendario esterno, messaggistica).
- Creare o modificare tool.
- Trattare un'inferenza come Fact o Evidence senza una Proposal approvata.

### Notifiche

- Una Proposal `proposed` crea una Notification in-app (NAS-83) con `trigger = ai.proposalPending`, `source = ai`, `threadKey = proposal:{id}`, deep link alla card. Niente email.
- Accept, dismiss ed expire risolvono la notifica. Snooze la risolve; quando la Proposal riappare, ne nasce una nuova.
- Il centro notifiche non è la inbox delle Proposal: è solo il segnale. La dashboard può mostrare le Proposal pending come widget.

### Sicurezza

- Il modello non ha accesso a URL, shell, filesystem o tool non registrati.
- I risultati dei tool sono dati, non istruzioni: il system prompt lo dice e l'orchestrator li delimita.
- Ogni tool call è validata lato server; un payload invalido non crea una Proposal.
- Il gate finale è l'approvazione umana: un prompt injection può produrre una Proposal sbagliata, non una scrittura.

## Schema concettuale

```text
ToolDefinition
  name, module, kind ∈ {query, proposal}, description,
  inputSchema, outputSchema?, version, requiredScope

Conversation
  id, title, scope, modelId, createdAt, updatedAt

Message
  id, conversationId, role, content, toolCalls?, usage?, createdAt

Proposal
  id, title, summary, status, applicationStatus,
  model, policySnapshot, conversationId?, messageId?, scope,
  contextRefs[], selectedEffectIds[], effects[],
  createdAt, seenAt?, acceptedAt?, dismissedAt?, snoozedUntil?, expiredAt?

ProposalEffect
  id, module, command, schemaVersion, displayLabel,
  payload, localRef?, entityId?, targetRef?, expectedVersion?,
  explanation, status, error?, resultRef?, attempts
```

## Invarianti

1. Nessuna scrittura persistente di dominio senza una Proposal approvata.
2. Il catalogo non contiene tool di scrittura diretta o di apply.
3. Ogni effetto è un comando tipizzato del modulo proprietario, validato e idempotente.
4. Un aggregate per transazione; nessuna transazione cross-module.
5. Gli effetti si applicano in ordine; un `localRef` deve risolvere a un effetto precedente.
6. Prima dell'accettazione le precondizioni rendono la Proposal `expired`; dopo, l'effetto fallisce `stale`.
7. L'utente può accettare un sottoinsieme; gli altri effetti sono `skipped`.
8. L'applicazione è parziale e visibile; nessun rollback.
9. La provenienza è `contextRefs` + modello/policy + spiegazione, non il prompt integrale.
10. Il ModelRegistry non fa downgrade silenziosi di retention/residency/sensitivity.
11. L'AI non espande lo Scope, non si auto-approva, non ha side effect esterni.
12. Una Proposal pending notifica in-app; accept/dismiss/expire la risolvono.
13. Una Proposal `expired` non si accetta: si rigenera.

## Conseguenze

- **NAS-47**: tabelle Conversation, Message, Proposal, ProposalEffect; retention, deletion, tombstone.
- **NAS-51**: adapter AiPort, dati ModelRegistry, streaming e Workflow per generazioni lunghe.
- **NAS-56**: policy di privacy, sensibilità e residenza; questo ADR fissa gli hook e lo snapshot.
- **NAS-45**: modello di Scope; il catalogo tool è filtrato.
- **NAS-83**: notifica `ai.proposalPending` in-app.
- **NAS-55 / NAS-57 / NAS-63 / NAS-54**: ogni modulo registra query tool e proposal tool derivati dai propri comandi.
- **NAS-62**: la dashboard può mostrare le Proposal pending come widget, senza duplicare la inbox.
- **NAS-53**: la roadmap include il contratto AI.

## Alternative scartate

- **Tool di scrittura diretta con conferma**: la Proposal diventa un dialog, non un contratto; provenienza e multi-effetto si perdono.
- **Un solo propose con union**: schema enorme e difficile da versionare; i tool per modulo sono più chiari.
- **Auto-apply per azioni reversibili**: serve un modello di rischio e un undo che v1 non ha.
- **Auto-apply per confidence**: un errore strutturale passerebbe senza conferma.
- **Un'unica macchina a stati**: mescola approvazione ed esecuzione; meglio `status` + `applicationStatus`.
- **Tutto-o-niente**: un effetto sbagliato blocca gli altri.
- **Editing inline**: la provenienza si confonde; meglio una nuova Proposal.
- **Prompt integrale**: duplica dati personali e conversazione.
- **Ri-validazione silenziosa**: la proposta cambia senza che l'utente la veda.
- **Nessuna precondition**: può sovrascrivere modifiche.
- **Effetti indipendenti**: il caso multi-modulo richiede più approvazioni.
- **Grafo di dipendenze**: complessità non giustificata; ordine + `localRef` copre v1.
- **Conversazione effimera**: niente ripresa né audit.
- **Modello fisso**: il provider-agnosticismo resta sulla carta.
- **Nessun retry**: perde il lavoro già applicato.
- **Nessuna notifica**: una Proposal generata in background passa inosservata.
- **Set curati o meta-tool**: più orchestrazione per un catalogo v1 ancora piccolo.
- **Auto-apply, agenti autonomi, tool esterni**: fuori da v1.
