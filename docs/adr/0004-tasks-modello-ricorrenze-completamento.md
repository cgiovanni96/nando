# 0004 — Tasks: modello, ricorrenze, completamento

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-57 — Tasks: modello, ricorrenze, completamento
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Tasks è la prima capability concreta e deve reggere il caso “task puntuale che alimenta un Habit” senza duplicare un task manager altrove. Il contratto intermodulo (ADR-0003) impone un solo Space proprietario, `activityId` per la deduplicazione, `Completion` come fatto datato e rettifiche append-only. Il handoff non specifica schema, ricorrenze né stati.

## Decisione

### Entità

- **Task**: la definizione — titolo, note, `spaceId`, `recurrenceRule?`, `timeZone`, `createdAt`, `endedAt?`. Non porta lo stato di esecuzione.
- **TaskOccurrence**: l'istanza schedulata — `id`, `taskId`, `dueAt?` o `dueDate?`, `status`, `completedAt?`, `activityId?`.
- Ogni Task ha **almeno un'Occurrence**. Un task una tantum ne ha esattamente una.
- Lo Space è del Task; l'Occurrence eredita il proprietario e non lo cambia. Per spostare un task in un altro Space si sposta il Task.
- Completamento, evidenza e deduplicazione puntano all'**Occurrence**, mai al Task.

### Stati

- **Occurrence**: `open` → `completed` | `skipped` | `cancelled`. Sono terminali; la riapertura passa da una Rectification.
- **Task**: `active` | `ended`. `endedAt` viene impostato quando la serie finisce per regola o viene cancellata.
- Niente `in_progress`, `blocked`, priority o tag in v1. Rimandare significa cambiare la data.
- **Skip**: chiude una singola Occurrence senza completamento e senza Evidence; la serie continua.
- **Cancel**: chiude un Task o una Occurrence senza completamento e senza Evidence. Cancellare una serie chiude le occorrenze future; quelle passate restano aperte finché non vengono chiuse esplicitamente.

### Ricorrenza

- `recurrenceRule` è un **RRULE subset RFC 5545**: daily, weekly, monthly, yearly, `interval`, `byweekday`, `count`, `until`.
- La regola si valuta nella `timeZone` IANA del Task.
- Le Occurrences sono materializzate con una finestra in avanti (proposta: 30 giorni) e rigenerate; non sono infinite.
- Completare in anticipo **non sposta la serie**: la prossima Occurrence resta alla data prevista.
- Le Occurrences passate restano `open` e overdue finché non vengono completate, saltate o cancellate.
- La modifica ha due scope: **serie** (titolo, regola, orario) oppure **singola Occurrence** (data, note). “Questa e le future” è uno **split della serie**: la vecchia termina, ne nasce una nuova.
- Un Task una tantum non ha regola; la sua unica Occurrence è la sua istanza.

### Tempo

- Task con orario: `dueAt` in UTC più `timeZone` IANA.
- Task tutto-il-giorno: `dueDate` come data locale, senza ora.
- La conversione a UTC avviene al bordo; il dominio conserva la timezone.
- DST: la ricorrenza si valuta nella timezone del Task. Un'ora inesistente si normalizza all'istante valido successivo; un'ora doppia si risolve alla prima occorrenza.

### Completamento e riapertura

- Completare crea un **Completion** con `activityId`, `occurredAt`, `provenance`; l'Occurrence passa a `completed`.
- Tasks **non conosce gli Habit**. Il Completion emette un evento `TaskCompleted` con `activityId`; Habits consuma l'evento per le proprie binding attive e crea l'evidenza, deduplicata per `(habit, activityId, period)`.
- Riaprire aggiunge una **Rectification** che annulla il Completion, emette `TaskCompletionReverted` e riporta l'Occurrence a `open`. Habits rettifica l'evidenza; non la cancella.
- Annullare o saltare non produce Completion né Evidence.
- Un Task completato non può essere cancellato: solo rettificato.

### Calendar

- Calendar mostra i Task con `dueAt` come **proiezione read-only**: non crea eventi separati e non duplica l'entità.
- Completare o spostare il Task aggiorna la proiezione.
- La resa vive nel Calendar interno (NAS-55); il modello del Task non cambia.

### Cancellazione

- `cancel` è la rimozione che l'utente vede; nessun hard delete nel corso normale.
- La purge avviene solo con la deletion dello Space (ADR-0002).

## Schema concettuale

```text
Task
  id, title, notes, spaceId?, recurrenceRule?, timeZone, createdAt, endedAt?

TaskOccurrence
  id, taskId, dueAt?, dueDate?, status, completedAt?, activityId?
  status ∈ {open, completed, skipped, cancelled}

Completion
  id, occurrenceId, activityId, occurredAt, provenance, rectifiedBy?
```

## Invarianti

1. Ogni Task ha almeno un'Occurrence.
2. Lo stato di esecuzione vive solo sull'Occurrence.
3. Completamento ed Evidence puntano all'Occurrence, mai al Task.
4. Ogni Completion ha un `activityId`.
5. Riaprire non cancella: rettifica.
6. Completare in anticipo non sposta la serie.
7. Un Task cancellato non genera nuove Occurrences; quelle passate restano chiudibili.
8. Le Occurrences passate restano aperte finché non vengono chiuse.
9. Calendar non duplica i Task.
10. Lo Space proprietario è del Task e non cambia a livello di Occurrence.

## Conseguenze

- **NAS-55 Calendar**: proiezione dei Task con `dueAt`, nessun evento duplicato.
- **NAS-63 Habits binding**: il binding punta al Task o alla serie; l'evidenza punta all'Occurrence tramite `activityId`.
- **NAS-58 AI**: completare un task è un comando idempotente con `activityId`.
- **NAS-62 Dashboard**: “oggi” e “in ritardo” leggono le Occurrences aperte.
- **NAS-47**: materializzazione delle Occurrences, retention e purge.

## Alternative scartate

- **Occurrence solo per le ricorrenze**: due percorsi di completamento da mantenere.
- **Ogni occorrenza è un Task**: definizione e istanza si confondono.
- **`in_progress`, `blocked`, priority, tag**: rumore per un single-user.
- **`completedAt` sul Task**: niente storia, niente dedup, niente rettifiche.
- **Riaprire = nuovo task**: scomodo per un errore di click.
- **Auto-skip delle occorrenze perse**: nasconde le occasioni mancate.
- **Subtask come Task figli**: gerarchia non necessaria in v1.
- **Calendar con eventi duplicati**: due verità da sincronizzare.
