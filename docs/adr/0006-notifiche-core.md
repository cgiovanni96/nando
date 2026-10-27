# 0006 — Notifiche core: richieste, digest e consegna

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-83 — Notifiche core: trigger, preferenze, dedup
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Notifiche è un servizio core (ADR-0005) usabile dalle capability, ma non deve diventare un secondo task manager né un generatore di rumore. Il handoff fissa due punti: i promemoria individuali e i riepiloghi sono opt-in e disattivati di default; la prevenzione della notification fatigue è un requisito aperto. La decisione dell'utente aggiunge il vincolo opposto per l'in-app: **in-app sempre**, email configurabile per task, web push fuori dalla v1.

La separazione che regge è:

- **Notification** = segnale in-app, sempre creato quando il trigger scatta.
- **Digest** = email periodica opt-in, composta al momento dell'invio; non è un canale della Notification.
- **NotificationRequest** = comando idempotente con cui un producer chiede una Notification.

Così l'in-app non ha un interruttore e l'email non duplica il centro notifiche.

## Decisione

### Confini

- Il **producer** (Tasks, Habits, AI, sistema) conosce il proprio dominio e calcola un `triggerAt` assoluto in UTC. Non passa lo `Schedule` a Notifications.
- **Notifications** possiede scheduling, deduplicazione, preferenze, centro in-app, composizione del digest e stato di consegna. Non conosce Task, Habit o Proposal.
- La **piattaforma** fornisce l'adapter email HTTP e il dispatcher Cron/Queues. Il provider si sceglie in NAS-51; niente SMTP nel Worker.
- Il producer invia la richiesta tramite la porta del servizio. Quando nasce dentro una transazione, passa dall'outbox del producer come comando idempotente (ADR-0003).

### NotificationRequest

```text
NotificationRequest
  requestId        // idempotency key della registrazione
  dedupKey         // identità logica della notifica, stabile tra reschedule
  threadKey        // raggruppa trigger della stessa occorrenza, es. task:{occurrenceId}
  source           // tasks | habits | ai | system
  entityRef        // entità sorgente
  trigger          // task.dueSoon | task.overdue | task.starts | ...
  triggerAt        // istante assoluto UTC
  timeZone         // visualizzazione
  title, body      // testo italiano fornito dal producer
  deepLink?        // route nell'app
  priority         // low | normal | high
```

- Notifications fa upsert della richiesta pendente per `(recipientId, dedupKey)`.
- Un `requestId` ripetuto restituisce lo stesso risultato: nessuna doppia notifica.
- `dedupKey` identifica la notifica logica; se il producer la rischedula, la stessa chiave aggiorna la richiesta pendente. Se era già scattata, il producer la risolve e ne registra una nuova revisione.
- `threadKey` serve al supersede: una notifica più recente nello stesso thread risolve le precedenti non lette.

### Trigger dei Task

- **Punto** (senza `from`): `task.dueSoon` prima di `to`, `task.overdue` dopo `to`.
- **Range o blocco** (con `from`): `task.starts` prima di `from`, `task.overdue` dopo `to`. Niente `dueSoon` sulla fine di un range: il blocco è già visibile in Calendar.
- **Offset per task**: `Task.reminderOffsetMinutes`, `null` = default del tipo, `0` = al momento. Si applica a `dueSoon` per un punto e a `starts` per un range; `overdue` non ha offset.
- **Default**: all-day 1440 minuti (un giorno prima alle 08:00 locali), timed 30 minuti. Per un all-day il riferimento sono le 08:00 locali del giorno rilevante; per un timed è `to` o `from`.
- Se `triggerAt` è già passato alla registrazione, la notifica scatta subito. Se il task è già overdue, si programma solo `overdue`.
- Ricorrenza: ogni Occurrence ha i propri trigger e il proprio `threadKey`.
- Task completato, saltato o cancellato: le richieste pendenti vengono cancellate e le notifiche attive risolte.
- Task rischedulato: le richieste pendenti vengono aggiornate; una notifica già scattata viene risolta con motivo `rescheduled`.

### Stati

**Notification** — stato utente:

- `unread` → `read` | `dismissed`; `resolvedAt` quando la sorgente è chiusa o la notifica è superata.
- `readAt`, `dismissedAt`, `resolvedAt`, `resolutionReason` (`completed`, `cancelled`, `skipped`, `superseded`, `rescheduled`), `supersededBy?`.
- Il badge conta le notifiche `unread` e non risolte. Dismiss implica read.
- Il centro mostra le attive; la storia resta fino alla retention.

**ScheduledNotification** — stato del dispatcher:

- `pending` → `fired` | `cancelled`.
- Unicità su `(recipientId, dedupKey)` mentre è `pending`.

**DigestRun** — stato dell'email:

- `pending` → `sent` | `failed` | `skipped`.
- `skipped` quando non ci sono elementi: nessuna email vuota.
- Unicità su `(userId, digestDate)`.

### Dedup

- Registrazione: `requestId` idempotente.
- Richiesta pendente: unica per `(recipientId, dedupKey)`.
- Notifica creata: unica per `(recipientId, requestId)`.
- Supersede: quando nasce una notifica in un `threadKey` con una precedente non letta, la precedente riceve `resolvedAt` e `resolutionReason = superseded`; il centro mostra un solo segnale.
- Il digest non usa il dedup delle notifiche: è un artefatto giornaliero con chiave `(userId, digestDate)`.

### Digest

- **Opt-in globale**: `digestEnabled` default `false`; `digestTime` default `08:00` nella timezone dell'utente.
- **Opt-in per task**: `Task.emailDigest` default `false`. L'email contiene solo i task con il flag attivo.
- **Composizione**: Notifications chiama i `DigestContributor` registrati. In v1 l'unico contributor è Tasks; le capability future potranno aggiungerne.
- **Sezioni**: `overdue` (scaduti e aperti), `today` (in scadenza oggi, non già overdue), `starting` (range che iniziano oggi). Dedup per Occurrence, priorità `overdue` > `today` > `starting`.
- **Contenuto**: titolo, orario o giornata, Space, deep link. Niente note: l'email è minima e il task resta la fonte di verità.
- **Una email al giorno**: `DigestRun` unico per `(userId, digestDate)`. Se non ci sono elementi, `skipped` e nessun invio.
- **Snapshot**: il contributor legge lo stato al momento del digest; una modifica successiva appare nel digest del giorno dopo.
- **Capability**: in v1 solo Tasks contribuisce. Le capability ricevono notifiche in-app; l'email per loro è fuori scope.

### Quiet hours, priorità e consegna

- **Quiet hours**: default `22:00–08:00` nella timezone dell'utente, configurabili. Valgono solo per l'email del digest: se l'orario cade nella finestra, l'invio slitta alla fine. L'in-app viene creata comunque.
- **Priorità**: `low | normal | high`, fornita dal producer. Mapping Task: `starts` = low, `dueSoon` = normal, `overdue` = high. Alta priorità cambia ordine e colore, non bypassa le quiet hours.
- **Email**: adapter HTTP con `idempotencyKey = digest:{userId}:{digestDate}`; retry con backoff; dopo N tentativi `failed` con errore visibile nelle impostazioni. L'in-app non è bloccata da un errore email.
- **In-app**: la Notification è la consegna; il client legge il centro. Aggiornamento in tempo reale (SSE o polling) è una scelta di UI.
- **Retention**: 30 giorni dalla creazione per Notification, ScheduledNotification chiuse e DigestRun. Il task resta la fonte di verità.

## Schema concettuale

```text
NotificationRequest
  requestId, dedupKey, threadKey, source, entityRef, trigger,
  triggerAt, timeZone, title, body, deepLink?, priority

ScheduledNotification
  id, requestId, recipientId, dedupKey, threadKey, source, entityRef, trigger,
  triggerAt, timeZone, title, body, deepLink?, priority,
  status, firedAt?, cancelledAt?
  status ∈ {pending, fired, cancelled}

Notification
  id, requestId, recipientId, threadKey, source, entityRef, trigger,
  title, body, deepLink?, priority, createdAt,
  readAt?, dismissedAt?, resolvedAt?, resolutionReason?, supersededBy?
  resolutionReason ∈ {completed, cancelled, skipped, superseded, rescheduled}

NotificationSettings
  userId, timeZone, quietHoursStart, quietHoursEnd,
  digestEnabled, digestTime

DigestRun
  id, userId, digestDate, status, itemCount, sentAt?, attempts, lastError?
  status ∈ {pending, sent, failed, skipped}
```

## Invarianti

1. Ogni richiesta accettata produce una Notification in-app; l'in-app non ha un interruttore.
2. Il producer calcola `triggerAt` assoluto; Notifications non legge `Schedule` né tabelle di altri moduli.
3. Il dispatcher reclama le richieste dovute in modo atomico e idempotente.
4. `requestId` è idempotente; una richiesta pendente è unica per `(recipientId, dedupKey)`.
5. Una notifica più recente nello stesso `threadKey` supersede le precedenti non lette.
6. Le quiet hours valgono solo per l'email; high priority non le bypassa.
7. Il digest è opt-in globale e per task; senza elementi non viene inviato.
8. Un errore email è visibile e non blocca l'in-app.
9. La retention è 30 giorni.
10. Il web push è fuori dalla v1.
11. In v1 solo Tasks contribuisce al digest.
12. Notification non è Evidence, Proposal o Signal.

## Conseguenze

- **NAS-47**: tabelle `ScheduledNotification`, `Notification`, `NotificationSettings`, `DigestRun`; dispatcher, purge a 30 giorni, DLQ e outbox.
- **NAS-51**: adapter email HTTP e scelta del provider; Cron ogni minuto e Queues per il fan-out; niente SMTP nel Worker.
- **NAS-55 / NAS-57**: il Task acquisisce `emailDigest` e `reminderOffsetMinutes`; il catalogo trigger vive in Tasks.
- **NAS-58**: le Proposal AI notificano in-app; niente email in v1.
- **NAS-61 / NAS-63**: Habits usa la porta per notifiche in-app; l'email è fuori scope.
- **NAS-62**: dashboard e badge leggono le notifiche non lette e le Occurrence overdue.
- **NAS-53**: la roadmap include il contratto notifiche.

## Alternative scartate

- **Notifications valuta gli Schedule**: conosce i domini o un modello di schedule condiviso; il producer è più pulito.
- **Email immediate per task**: troppe email e più fatigue; il digest è il default.
- **Dedup solo per `(occurrenceId, trigger, channel)`**: non copre Habit, AI o altre capability.
- **`scheduled/delivered/failed` come stati della Notification**: mescola stato utente e stato del dispatcher; meglio due tabelle.
- **High priority bypassa le quiet hours**: vanifica la finestra e sveglia l'utente.
- **Email come canale della Notification**: duplica il centro e confonde preferenze; il digest è separato.
- **Tasks possiede il digest**: Notifications non sarebbe più il servizio core e le capability non potrebbero contribuire.
- **Timer per task o Workflow per ogni reminder**: il dispatcher Cron su istanti assoluti è più semplice e robusto.
- **Nessuna retention**: il centro diventa un log.
- **Web push in v1**: fuori scope.
