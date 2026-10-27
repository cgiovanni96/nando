# 0003 — Contratto intermodulo: identità, riferimenti, evidenze, idempotenza

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-46 — Contratto intermodulo: identità, riferimenti, evidenze, idempotenza
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Nando è un modular monolith in cui Tasks, Calendar, Knowledge, Habits e i moduli futuri condividono entità e conseguenze. Il caso guida è **“compra fiori”**: un task e un evento Space descrivono la stessa azione, e un Habit collegato non deve contare due volte. Servono regole stabili per identità, riferimenti, transazioni, idempotenza e correzioni, valide anche quando l'AI propone modifiche cross-module.

## Decisione

### Confini

- Ogni modulo possiede il proprio schema e non legge le tabelle di un altro.
- Le letture cross-module passano da **porte tipizzate** o da read model; gli effetti collaterali da **domain event**.
- Le porte sono sincrone quando serve una risposta immediata. Gli eventi coprono ciò che può essere differito, ritentato o distribuito a più consumatori.

### Comandi ed eventi

- Ogni comando porta `commandId` (idempotency key), `actor`, `source`, `correlationId`, `causationId`, `occurredAt`.
- Il server conserva `(actorId, commandName, key) → result` per una finestra: un replay restituisce lo stesso risultato invece di creare un duplicato.
- Ogni evento porta `eventId`, `type`, `version`, `occurredAt`, `actor`, `source`, `correlationId`, `causationId` e gli `EntityRef` coinvolti. **Niente snapshot di dominio**: il consumatore legge lo stato corrente via porta.
- L'evento è scritto nell'**outbox** nella stessa transazione dell'aggregate che lo produce. La consegna è at-least-once; i consumatori deduplicano per `eventId`.
- Dopo un numero configurabile di tentativi l'evento finisce in **dead-letter** e diventa un errore visibile, non un silenzio.

### Identità dell'attività

- L'**`activityId`** è un UUID condiviso dai record che descrivono la stessa azione: task, evento Space, completamento manuale.
- Non è un'entità e non ha lifecycle proprio: è un valore che abilita la deduplicazione.
- Il primo record genera l'`activityId`.
- L'unione di due record avviene solo tramite una **Proposal approvata**. Il `Link` registra `activityId`, provenienza e motivo.
- Lo **split** è una **Rectification**: assegna un nuovo `activityId` a uno dei record e rettifica le evidenze derivate.
- Nessun merge automatico, nessuna chiave deterministica dal titolo.

### Evidenze

- Un'evidenza è unica per `(habitId, activityId, period)`.
- La stessa azione può alimentare più habit, ciascuno con la sua evidenza. Non c'è dedup globale tra habit.
- Un'evidenza può essere rettificata ma non cancellata nel corso normale.

### Riferimenti

- `EntityRef { type, id }` è un riferimento debole: nessuna FK cross-module.
- Se il target viene cancellato, il riferimento resta storico e le viste attive lo filtrano (**tombstone**).
- I riferimenti cross-Space non trasferiscono la proprietà (ADR-0002).

### Transazioni

- Un comando scrive **un solo aggregate** e il suo evento di outbox nella stessa transazione.
- Nessuna transazione cross-module, nessun two-phase commit.
- Una Proposal con più effetti produce **un comando per effetto**. La Proposal traccia lo stato di ciascuno e mostra i fallimenti: non è tutto-o-niente.

### Rettifiche

- Nessuna cancellazione di evidenze o completamenti nel corso normale. La purge di uno Space in deletion è l'unica eccezione, dopo la finestra di grazia (ADR-0002).
- Una **Rectification** supersede o annulla con motivo, provenienza e timestamp; l'originale resta interrogabile.
- Le viste attive mostrano lo stato rettificato; la storia mostra entrambi.

## Il caso guida

1. Task “compra fiori” per il 28/10, Space Relazioni.
2. Evento Space “compra fiori” nella stessa data.
3. L'AI propone che siano la stessa attività; l'utente approva. Il `Link` assegna loro l'`activityId` **A**.
4. Il task viene completato: nasce `HabitEvidence(habit, A, 2026-10)`.
5. L'evento viene segnato come avvenuto: il secondo tentativo di evidenza `(habit, A, 2026-10)` viola l'unicità e non produce un doppio conteggio.
6. Se il link era sbagliato, una Rectification assegna un nuovo `activityId` **B** all'evento e rettifica l'evidenza derivata.

## Schema concettuale

```text
Outbox
  eventId, type, version, aggregateType, aggregateId, payload,
  occurredAt, publishedAt?, attempts, status

Idempotency
  actorId, commandName, key, result, createdAt, expiresAt
  unique(actorId, commandName, key)

Link
  id, fromRef, toRef, kind, activityId?, provenance

Rectification
  id, targetRef, action, reason, provenance, createdAt

HabitEvidence
  id, habitId, activityId, period, occurredAt, provenance, rectifiedBy?
  unique(habitId, activityId, period)
```

## Invarianti

1. Nessun modulo legge le tabelle di un altro.
2. Ogni comando ha una chiave idempotente; il replay restituisce il risultato.
3. Ogni evento ha un `eventId` univoco; i consumatori sono idempotenti.
4. Un aggregate per transazione; l'outbox è nella stessa transazione.
5. I riferimenti cross-module sono `EntityRef`, senza FK.
6. Un'evidenza è unica per `(habit, activityId, period)`; più habit possono condividere l'activity.
7. Merge solo via Proposal approvata; split via Rectification.
8. Le correzioni sono append-only.
9. Gli eventi trasportano ID e metadati, non snapshot.

## Conseguenze

- **NAS-47**: tabelle outbox, idempotency, link e rectification; retention, purge e dead-letter.
- **NAS-58**: una Proposal con più effetti equivale a più comandi; lo stato è per effetto.
- **NAS-57**: il completamento di un Task produce un `activityId` e un'evidenza.
- **NAS-63**: unique constraint, multi-habit e rettifiche.
- **NAS-62**: read model alimentati da eventi, non join tra schemi.
- **NAS-51**: outbox consegnata da Cloudflare Queues o Workflows, at-least-once.

## Alternative scartate

- **Solo eventi** o **solo porte sincrone**: entrambe le versioni estreme accoppiano o complicano senza bisogno.
- **Activity come entità kernel**: aggiunge un lifecycle e un quarto oggetto da tenere allineato.
- **Chiave deterministica dal payload**: rename e azioni legittimamente uguali rompono il conto.
- **Transazione cross-module o 2PC**: accoppia i confini e non è giustificata da un'app single-user.
- **Tabelle condivise o viste read-only**: congelano gli schemi e trasformano il monolite in un blob.
- **Soft delete o hard delete delle evidenze**: perdono motivo e storia.
- **Snapshot negli eventi**: duplicano il dominio e invecchiano.
- **Merge automatico**: un errore di dedup diventa difficile da scoprire e annullare.
