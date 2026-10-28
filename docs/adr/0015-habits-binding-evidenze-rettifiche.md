# 0015 — Habits: binding, evidenze e rettifiche

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-63 — Habits: binding, evidenze, dedup, rettifiche
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

ADR-0004 ha lasciato a questo ticket il compito di collegare Tasks e Habits: il binding punta al Task o alla serie, l'evidenza punta all'Occurrence tramite `activityId`, la riapertura di un task produce una `Rectification` e `TaskCompletionReverted`. ADR-0003 ha fissato l'unicità `(habitId, activityId, period)` e le rettifiche append-only. ADR-0014 ha aggiunto il `periodKey` immutabile sull'evidenza e le regole di conteggio.

Restavano i confini: cosa distingue `active`, `disabled` e `closed`; quando un binding si chiude da solo; come si evita di contare due volte la stessa azione quando esiste un task collegato; se il passato si può recuperare; cosa accade a un habit archiviato.

## Decisione

### Binding

```text
HabitSourceBinding
  id, habitId, targetRef (EntityRef<Task>), state, provenance,
  createdAt, closedAt?, closeReason?
```

- Uno solo tipo di target in v1: **Task**. Lo stesso Task con `recurrenceRule` è la serie; senza regola è il monouso. La distinzione è comportamentale, non strutturale.
- **Tre stati con significati distinti:**
  - `active` — contribuisce;
  - `disabled` — spento dall'utente, il target esiste ancora, quindi riattivabile;
  - `closed` — terminale, perché il target non può più contribuire: task completato, serie terminata o cancellata.
- **Al massimo un binding `active` o `disabled` per coppia `(habitId, taskId)`.** Lo stesso task su **habit diversi** è ammesso e produce una evidenza per habit, come già deciso in ADR-0003.
- I binding si creano **solo dall'utente**. L'AI può proporne uno con una Proposal, mai attivarlo: un'associazione sbagliata gonfia un numero in silenzio.

### Chiusura automatica

- **Monouso**: si chiude al completamento, dopo aver prodotto l'evidenza, con `closeReason = target_completed`; si chiude alla cancellazione senza evidenza, con `target_cancelled`.
- **Serie**: resta `active` finché la serie non termina per regola (`endedAt`) o viene cancellata. Ogni occorrenza completata produce la propria evidenza, con il proprio `activityId`.
- **Nessuna chiusura per inattività.** Un binding non scade: chiuderlo è una decisione, non un timeout.
- **Chiudere un binding non cancella l'evidenza già prodotta.** La regola e il fatto sono due cose diverse.

### Evidenze

```text
HabitEvidence
  id, habitId, activityId, periodKey, occurredAt,
  provenance (manual | task | capability_event), sourceRef?, description?, rectifiedBy?
  unique(habitId, activityId, periodKey)
```

- `periodKey` è calcolato alla nascita nella timezone del habit con la configurazione vigente e **non cambia mai** (ADR-0014).
- `sourceRef` porta l'Occurrence che ha prodotto l'evidenza quando la provenance è `task`.
- La descrizione è opzionale anche sui check-in manuali.

### Flussi

1. **Completamento** — Tasks emette `TaskCompleted(activityId, occurrenceId, occurredAt)`. Habits crea un'evidenza per ogni binding `active` su quel Task; l'unicità per `(habit, activityId, periodKey)` impedisce il doppio conteggio. Un monouso si chiude subito dopo.
2. **Riapertura** — Tasks emette `TaskCompletionReverted(activityId)`. Habits scrive una `Rectification` con motivo `task_reopened`: l'evidenza resta, lo score la ignora. Il periodo si aggiorna, anche se era chiuso (ADR-0014).
3. **Cancel e skip** — nessun `Completion`, nessuna evidenza. Un binding su un task cancellato si chiude.
4. **Check-in manuale** — sempre disponibile. Se esistono binding attivi, la UI propone le attività collegate ancora aperte: sceglierne una riusa il suo `activityId` e produce una sola evidenza; scegliere "altra azione" crea un `activityId` nuovo. Il doppio conteggio diventa una scelta esplicita, non un errore silenzioso.
5. **Revoca** — l'utente annulla un'evidenza con una `Rectification` e motivo `manual_revocation`. L'originale resta interrogabile.
6. **Split di attività** — ADR-0003 assegna un nuovo `activityId` a uno dei record. L'evidenza del record che perde l'identità viene rettificata con motivo `activity_split` e ne nasce una nuova sotto il nuovo `activityId`, con lo stesso `occurredAt`: il conteggio netto non cambia e la storia resta.
7. **Habit archiviato** — nessuna nuova evidenza: i completamenti vengono ignorati, i binding restano nello storico, la riattivazione riparte dal periodo corrente (ADR-0014).

### Evidenza retroattiva

- Collegare un Task **già completato** può creare l'evidenza, ma solo se quel periodo è **valutato** per l'habit:
  - sempre nel periodo corrente;
  - in un periodo chiuso solo se l'habit esisteva ed era valutato allora;
  - **mai** prima del primo periodo valutato: un habit nato il 30 ottobre non conta un'azione del 28.
- È un'azione esplicita, mai automatica: un binding creato per sbaglio non deve aggiungere evidenze che non volevi contare.

### Rettifiche

- Append-only, con motivo esplicito: `task_reopened`, `task_cancelled`, `manual_revocation`, `activity_split`, `duplicate`.
- Una rettifica non cancella e non modifica l'evidenza: la supera. Lo score è derivato, quindi il periodo si ricalcola da solo.
- Se un'evidenza rettificata era l'unica del periodo, il periodo passa da `met` a `missed`. È il comportamento corretto: il fatto non c'era.

### Fuori v1

- Binding a entità diverse da Task (azioni Space, capability, Learning, Relationships): il `targetRef` è già un `EntityRef`, ma nessun altro tipo è ammesso finché non esiste un productore.
- Binding a una singola Occurrence: il binding è al Task o alla serie, mai all'istanza (ADR-0004).
- Evidenze generate da segnali esterni o import.

## Schema concettuale

```text
HabitSourceBinding
  active ──completamento──▶ closed (target_completed)   + evidenza
  active ──cancellazione──▶ closed (target_cancelled)   senza evidenza
  active ◀──▶ disabled                                   riattivabile

HabitEvidence
  activityId ── uniqueness ── (habitId, activityId, periodKey)
  periodKey  ── immutabile
  rectifiedBy ──▶ Rectification(annul | supersede, reason)

Eventi consumati da Habits
  TaskCompleted(activityId, occurrenceId, occurredAt)
  TaskCompletionReverted(activityId)
  TaskCancelled / series ended
```

## Invarianti

1. Un binding è una regola, un'evidenza è un fatto: chiudere la regola non tocca il fatto.
2. Un solo binding `active` o `disabled` per `(habit, task)`; lo stesso task su habit diversi è ammesso.
3. La stessa attività non produce due evidenze nello stesso habit e nello stesso periodo.
4. Cancel e skip non producono evidenze.
5. Nessuna evidenza nasce prima del primo periodo valutato del habit.
6. Il `periodKey` di un'evidenza non cambia mai.
7. Le rettifiche sono append-only: l'originale resta interrogabile.
8. Un'evidenza rettificata non contribuisce allo score.
9. Un habit archiviato non accetta nuove evidenze.
10. Il check-in manuale è sempre disponibile; il riuso di un'attività è proposto, mai assunto.
11. L'AI propone binding, non li attiva.

## Conseguenze

- **ADR-0003:** l'unicità `(habitId, activityId, period)` è `(habitId, activityId, periodKey)`; il `periodKey` è un valore, non una FK.
- **ADR-0004:** `TaskCompleted` e `TaskCompletionReverted` sono il contratto consumato da Habits; il completamento resta dell'Occurrence.
- **ADR-0014:** l'evidenza rettificata aggiorna il periodo, anche chiuso; i periodi `paused` e `not_evaluated` restano neutrali.
- **NAS-60:** la UI deve mostrare fonti attive separate dalla storia, e proporre le attività collegate nel check-in.
- **NAS-62:** il conteggio delle evidenze in dashboard legge solo evidenze non rettificate.
- **Roadmap:** il cluster Habits è completo; restano Knowledge e Dashboard prima della roadmap.

## Alternative scartate

- **Due stati (active/closed):** disattivare equivale a chiudere, e riaccendere richiede di ricreare perdendo la distinzione fra "l'ho spento" e "non può più contribuire".
- **Binding attivo con flag `muted`:** più semplice nel database, più ambiguo nel dominio.
- **Chiusura sull'ultima occorrenza di una serie:** un habit mensile si staccherebbe a ogni completamento.
- **Nessuna chiusura automatica:** le fonti attive si riempiono di task già fatti.
- **Check-in manuale sempre indipendente:** il numero si gonfia senza che l'utente se ne accorga.
- **Check-in manuale disabilitato con un binding attivo:** impedisce di registrare un'azione vera quando il task è in ritardo o non esiste più.
- **Binding che genera evidenza automaticamente sul passato:** aggiunge conteggi che non volevi.
- **Retroattivo fino a prima della nascita del habit:** contraddice il periodo di nascita neutro di ADR-0014.
- **Habit archiviato che continua a registrare evidenze:** accumula fatti che nessuno valuterà.
- **Cancellare un'evidenza:** perde motivo e storia; la rettifica esiste per questo.
