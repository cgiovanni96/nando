# 0004 — Tasks: modello, ricorrenze, completamento

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-57 — Tasks: modello, ricorrenze, completamento; revisione in NAS-55 — Calendar interno: vista sui task, range e timezone
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Tasks è core, non una capability (ADR-0005): è uno dei building block che Knowledge, Habits e le capability future usano. Deve reggere il caso “task puntuale che alimenta un Habit” senza duplicare un task manager altrove e, allo stesso tempo, coprire ciò che l'utente chiama evento. Il contratto intermodulo (ADR-0003) impone un solo Space proprietario, `activityId` per la deduplicazione, `Completion` come fatto datato e rettifiche append-only. La revisione NAS-55 elimina l'entità Event: una voce di calendario è una TaskOccurrence con Schedule.

## Decisione

### Entità

- **Task**: la definizione — titolo, note, `spaceId`, `recurrenceRule?`, `timeZone`, `createdAt`, `endedAt?`, `emailDigest`, `reminderOffsetMinutes?`. Non porta lo stato di esecuzione.
- **TaskOccurrence**: l'istanza — `id`, `taskId`, `schedule?`, `location?`, `participants?`, `status`, `completedAt?`, `activityId?`.
- **Schedule**: il value object del tempo — `allDay`, `from?`, `to`, `timeZone`.
- Ogni Task ha **almeno un'Occurrence**. Un task una tantum ne ha esattamente una. Un Task senza Schedule esiste (Inbox/backlog) ma non compare in Calendar.
- Lo Space è del Task; l'Occurrence eredita il proprietario e non lo cambia. Per spostare un task in un altro Space si sposta il Task.
- Completamento, evidenza e deduplicazione puntano all'**Occurrence**, mai al Task.
- **Event non è un'entità.** Ciò che l'utente chiama evento è una TaskOccurrence con Schedule; il termine resta nella UI.
- **Notifiche**: `emailDigest` (default false) decide l'inclusione nel digest email; `reminderOffsetMinutes` (null = default del tipo, 0 = al momento) decide quando arriva `dueSoon` o `starts`. L'in-app è sempre attiva; `overdue` non ha offset (ADR-0006).
- Partecipanti e luogo stanno sull'Occurrence. `Person` è core e minimale; i partecipanti sono `EntityRef<Person>`, senza inviti né risposte in v1.

### Schedule

- `allDay` determina il tipo di `from` e `to`: date locali oppure istanti UTC. Non si mescolano.
- `from` assente → punto: `27/10/2026`, `27/10/2026 10:45`.
- `from` presente → intervallo: `27/10/2026 → 30/10/2026`, `27/10/2026 10:45 → 12:00`.
- Per le date, `to` è inclusiva nella UI e il giorno successivo è il limite esclusivo nei calcoli. Per i timed, `to` è l'istante di fine.
- `to` è la scadenza: è ciò che l'utente chiama `dueDate`. `from` è opzionale e dice che il task occupa un intervallo.
- La conversione a UTC avviene al bordo; il dominio conserva la `timeZone`.
- Calendar rende nel timezone del viewer; ricorrenza e all-day si valutano nella timezone del Task; il dettaglio mostra la timezone originale.

### Stati

- **Occurrence**: `open` → `completed` | `skipped` | `cancelled`. Sono terminali; la riapertura passa da una Rectification.
- **Task**: `active` | `ended`. `endedAt` viene impostato quando la serie finisce per regola o viene cancellata.
- Niente `in_progress`, `blocked`, priority o tag in v1. Rimandare significa cambiare la data.
- **Stato temporale derivato**, non memorizzato: `upcoming` (`now < from`, o `to` se punto), `current` (`from ≤ now ≤ to`), `overdue` (`now > to` e `open`).
- Un task tutto-il-giorno scade alla fine del giorno nella sua timezone: `27/10` è overdue dal `28/10 00:00` locali.
- **Skip**: chiude una singola Occurrence senza completamento e senza Evidence; la serie continua. Per un evento significa “non avvenuto”.
- **Cancel**: chiude un Task o una Occurrence senza completamento e senza Evidence; per un evento significa “annullato”. Cancellare una serie chiude le occorrenze future; quelle passate restano aperte finché non vengono chiuse esplicitamente.
- **Completed** significa “fatto” per un task e “avvenuto” per un evento. È lo stesso stato, con due etichette di UI.

### Ricorrenza

- `recurrenceRule` è un **RRULE subset RFC 5545**: daily, weekly, monthly, yearly, `interval`, `byweekday`, `count`, `until`.
- La regola genera il `from` di ogni Occurrence; la durata del frame resta costante (es. ogni lunedì 10:00–11:00; ogni primo del mese per tre giorni).
- La regola si valuta nella `timeZone` IANA del Task.
- Le Occurrences sono materializzate con una finestra in avanti (proposta: 30 giorni) e rigenerate; non sono infinite.
- **Un range è una sola Occurrence**, non N occorrenze giornaliere. N istanze sono una ricorrenza, non un range.
- Completare in anticipo **non sposta la serie**: la prossima Occurrence resta alla data prevista.
- Le Occurrences passate restano `open` e overdue finché non vengono completate, saltate o cancellate.
- La modifica ha due scope: **serie** (titolo, regola, orario) oppure **singola Occurrence** (data, luogo, partecipanti, note). “Questa e le future” è uno **split della serie**: la vecchia termina, ne nasce una nuova.
- Un Task una tantum non ha regola; la sua unica Occurrence è la sua istanza.

### Completamento e riapertura

- Completare crea un **Completion** con `activityId`, `occurredAt`, `provenance`; l'Occurrence passa a `completed`.
- Completare prima di `from` è permesso: per un task è normale, per un evento significa che è avvenuto prima o è stato spostato. La UI può chiedere conferma; il dominio non lo vieta.
- Tasks **non conosce gli Habits**. Il Completion emette un evento `TaskCompleted` con `activityId`; Habits consuma l'evento per le proprie binding attive e crea l'evidenza, deduplicata per `(habit, activityId, period)`.
- Riaprire aggiunge una **Rectification** che annulla il Completion, emette `TaskCompletionReverted` e riporta l'Occurrence a `open`. Habits rettifica l'evidenza; non la cancella.
- Annullare o saltare non produce Completion né Evidence.
- Un Task completato non può essere cancellato: solo rettificato.

### Calendar

- Calendar è una **vista core** sulle TaskOccurrence con Schedule, non un modulo con un'aggregato proprio. Non crea eventi separati e non duplica l'entità.
- Resa: punto all-day → chip nella riga all-day; punto timed → marker all'istante; range all-day → barra multi-giorno; range timed → blocco con inizio/fine.
- Completare, spostare o cancellare il Task aggiorna la vista.
- Nessun conflict detection, nessun invito, nessun sync esterno in v1.
- Le notifiche sono un servizio core separato; Calendar non le possiede.

### Cancellazione

- `cancel` è la rimozione che l'utente vede; nessun hard delete nel corso normale.
- La purge avviene solo con la deletion dello Space (ADR-0002).

## Schema concettuale

```text
Task
  id, title, notes, spaceId?, recurrenceRule?, timeZone, createdAt, endedAt?,
  emailDigest, reminderOffsetMinutes?

TaskOccurrence
  id, taskId, schedule?, location?, participants?, status, completedAt?, activityId?
  schedule = { allDay, from?, to, timeZone }
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
9. Calendar non duplica i Task e non ha un'entità Event.
10. Lo Space proprietario è del Task e non cambia a livello di Occurrence.
11. `from` e `to` sono dello stesso tipo; `from ≤ to`; `to` è la scadenza.
12. Un range è una sola Occurrence; N istanze richiedono una ricorrenza.
13. `overdue` è derivato e non viene salvato.

## Conseguenze

- **NAS-55 Calendar**: vista sui Task con Schedule; range come blocco; nessun evento duplicato.
- **NAS-83 Notifiche core**: trigger relativi a `from`/`to`, in-app sempre, digest email opt-in; il contratto vive in ADR-0006.
- **NAS-63 Habits binding**: il binding punta al Task o alla serie; l'evidenza punta all'Occurrence tramite `activityId`.
- **NAS-58 AI**: completare un task è un comando idempotente con `activityId`; una Proposal può creare o spostare Occurrences.
- **NAS-62 Dashboard**: “oggi”, “in corso” e “in ritardo” leggono le Occurrences aperte.
- **NAS-47**: materializzazione delle Occurrences, retention e purge.

## Alternative scartate

- **Event come entità separata**: tabella quasi sovrapposta a Task, due macchine a stati e due proprietari per lo stesso fatto.
- **Calendar come modulo con tabella propria**: duplica TaskOccurrence e crea due verità da sincronizzare.
- **Range = N occorrenze giornaliere**: confonde range e ricorrenza, rende ambiguo il completamento e moltiplica le evidenze.
- **Flag `block/window`**: un concetto in più per un caso che una scadenza senza `from` già copre; si aggiungerà solo se servirà.
- **Occurrence solo per le ricorrenze**: due percorsi di completamento da mantenere.
- **Ogni occorrenza è un Task**: definizione e istanza si confondono.
- **`in_progress`, `blocked`, priority, tag**: rumore per un single-user.
- **`completedAt` sul Task**: niente storia, niente dedup, niente rettifiche.
- **Riaprire = nuovo task**: scomodo per un errore di click.
- **Auto-skip delle occorrenze perse**: nasconde le occasioni mancate.
- **Subtask come Task figli**: gerarchia non necessaria in v1.
