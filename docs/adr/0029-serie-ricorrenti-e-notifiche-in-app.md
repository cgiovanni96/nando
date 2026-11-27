# 0029 — Serie ricorrenti e notifiche in-app (M3)

- **Stato:** accettato
- **Data:** 2026-11-26
- **Aggiornato:** 2026-11-27, con gli esiti del mock (NAS-160)
- **Ticket:** M3 — Ricorrenze e notifiche (grilling della milestone)
- **Emenda:** ADR-0004 (ricorrenza, scope di modifica, viste delle serie), ADR-0006 (trigger delle serie, offset, consegna), ADR-0023 (centro notifiche nella topbar)

## Contesto

M3 porta il flusso 3: un task ricorrente genera occorrenze e notifiche senza intervento, e completare una volta non rompe la serie. ADR-0004 e ADR-0006 hanno fissato il modello, ma il grilling di M3 ha trovato sei buchi:

- **Mesi senza il giorno.** Una serie mensile che parte il 31 non ha un comportamento definito.
- **Serie dopo uno split.** «Questa e le future» crea un Task nuovo, e in M5 il binding Habit che punta al Task vecchio smetterebbe di ricevere completamenti.
- **Rumore.** La materializzazione a 30 giorni riempie la board di card e le occorrenze ignorate riempiono Oggi. Una serie giornaliera ignorata produce un overdue al giorno.
- **Preferenze.** In ADR-0006 l'in-app non ha interruttore, e digest e quiet hours riguardano solo l'email, che è v1.1. Resta da dire cosa sono le preferenze in M3.
- **Trasporto.** Il dispatcher di ADR-0006 era pensato su Cloudflare Cron/Queues, ma il worker è pg-boss (ADR-0010). L'outbox di ADR-0003 non esiste ancora.
- **Centro notifiche.** La shell di ADR-0023 non ha una posizione per il centro notifiche.

## Decisione

### Serie

- Una **serie** è l'insieme delle occorrenze generate da una Recurrence rule. Il Task ha un **`seriesId`**: alla creazione vale quanto il suo `id`, e lo split lo copia sul Task nuovo. Board, Oggi, «Salta le precedenti» e l'overdue delle notifiche raggruppano per `seriesId`; in M5 il binding Habit può puntare alla serie.
- Il motore RRULE è un **subset scritto nel core**, senza librerie: daily, weekly, monthly, yearly, `interval`, `byweekday`, `count`, `until`. Genera date e ore locali nella timezone del Task e converte in UTC al bordo, così «lunedì alle 10» resta alle 10 locali dopo il cambio dell'ora.
- **Fine mese:** una serie mensile o annuale ancorata a un giorno che il mese non ha cade sull'ultimo giorno del mese (31 gennaio → 28 o 29 febbraio, 30 aprile; 29 febbraio → 28 febbraio negli anni non bisestili). È una deviazione voluta da RFC 5545, che salterebbe il mese.
- La materializzazione resta quella di ADR-0011: alla scrittura del Task le occorrenze dentro 30 giorni, poi un job giornaliero estende la finestra.

### Occorrenze toccate ed eccezioni

- Un'occorrenza è **toccata** se non è più nello stato in cui la regola l'ha generata: è un'eccezione, è `in_progress` o chiusa, oppure ha storia (Completion, Rectification, skip, cancel).
- Un'**eccezione** è un'occorrenza modificata con lo scope «solo questa» (Schedule o note). La regola non la sovrascrive più.
- Solo le occorrenze future e non toccate sono una proiezione della regola. Non portano fatti, quindi rigenerarle può aggiornarle, crearle o rimuoverle. Le occorrenze toccate e quelle passate non si rigenerano mai.

### Scope di modifica

- **Solo questa:** cambia Schedule o note di una occorrenza, che diventa un'eccezione.
- **Tutta la serie:** titolo, Space e promemoria stanno sul Task e valgono per tutte le occorrenze, quindi cambiarli da un'occorrenza non chiede lo scope. Una modifica di regola o orario rigenera solo le occorrenze future non toccate.
  - Su una serie settimanale con più giorni, spostare un'occorrenza sostituisce solo il suo giorno in `byweekday`: il mercoledì di lun/mer/ven portato a giovedì dà lun/gio/ven. Per le altre frequenze si sposta l'ancora.
- **Questa e le future** (split) all'occorrenza X:
  - la regola del Task vecchio riceve `until` subito prima di X;
  - nasce un Task nuovo con la regola modificata, lo stesso `seriesId`, titolo, Space, timezone e promemoria, e le sue occorrenze partono da X;
  - le occorrenze non toccate del Task vecchio da X in poi si rimuovono, quelle toccate restano al Task vecchio.

  Sulla prima occorrenza della serie lo split equivale a «Tutta la serie», e la UI offre solo quello.

- Il dialog dello scope preseleziona «Solo questa» per una modifica di data o orario e «Questa e le future» per una modifica di regola.
- La regola si modifica in un dialog che parte dalla riga «Ripete» del task. Sulla bozza la regola resta in attesa e si applica alla creazione.

### Aggiungere e togliere la regola

- **Aggiungere** una regola a un task una tantum richiede uno Schedule. L'occorrenza esistente diventa la prima della serie e le altre si materializzano nella finestra.
- **Togliere** la regola porta a `cancelled` le occorrenze future aperte, tranne la prossima, e il Task torna una tantum. Le occorrenze passate e la storia non si toccano.

### Serie nelle viste

- **Board Task** (ADR-0028): per ogni serie mostra l'ultima occorrenza in ritardo, quelle `in_progress` e la prima aperta non ancora scaduta. I ritardi precedenti stanno nella card dell'ultimo, con il conteggio e «Salta le precedenti», come in Oggi. Le altre occorrenze restano nel calendario e in Prossimi 7 giorni. La card ha l'icona della ricorrenza e il filtro scadenza continua a valere.
- **Oggi:** i ritardi della stessa serie stanno in una riga, la più recente, con il conteggio.
- **Salta le precedenti:** su un'occorrenza in ritardo, un solo comando fa skip di tutte le occorrenze `open` della stessa serie con scadenza precedente. Ogni skip resta nella storia; le `in_progress` non si toccano. Non esiste un auto-skip: ADR-0004 resta valido.

### Trigger e offset

- `task.dueSoon` e `task.starts` restano per occorrenza, con `threadKey = task:{occurrenceId}`.
- `task.overdue` usa `threadKey = series:{seriesId}:overdue`: un ritardo nuovo della stessa serie fa supersede di quello non letto, e il centro mostra un solo ritardo per serie. Il testo non porta un conteggio, perché il producer lo calcola alla registrazione e allo scatto non sarebbe più vero; il conteggio sta in Oggi.
- Il thread dell'overdue non è quello dell'occorrenza, quindi il supersede non tocca `dueSoon` e `starts`. Quando scatta, l'overdue risolve anche le notifiche attive del thread `task:{occurrenceId}`: per un'occorrenza resta un solo segnale.
- Il promemoria del Task diventa **`reminderMode ∈ {default, custom, none}`** con `reminderOffsetMinutes`, che vale solo per `custom` (0 = al momento). `none` spegne `dueSoon` e `starts`; l'overdue resta sempre.
- **NotificationSettings** porta gli offset di default per tipo: all-day 1440 minuti, cioè il giorno prima, rispetto alle 08:00 locali del giorno rilevante; timed 30 minuti prima. Si modificano nella pagina Impostazioni. Cambiarli riregistra le richieste pendenti dei task in `default`, con upsert per `dedupKey`.
- In M3 le preferenze sono solo queste. `digestEnabled`, `digestTime` e quiet hours restano nel modello di ADR-0006 e arrivano con l'email in v1.1.

### Trasporto e consegna

- Il comando Task scrive l'aggregate e il suo evento nell'**outbox** nella stessa transazione (ADR-0003).
- Un relay nel worker consegna gli eventi at-least-once tramite pg-boss, e i consumatori deduplicano per `eventId`.
- Il consumatore di Tasks legge il proprio Task e i default dalla porta di Notifications, calcola `triggerAt` e invia la NotificationRequest. Notifications non legge Task.
- Il dispatcher è un job pg-boss ogni minuto. Reclama le ScheduledNotification dovute in modo atomico, crea la Notification e applica il supersede.
- La purge a 30 giorni (ADR-0011) è un job giornaliero del worker. Sostituisce Cron e Queues di ADR-0006.

### Centro notifiche

- **Campanella nella topbar**, anche su telefono, con un badge sulle notifiche `unread` non risolte. Il popover elenca le attive, con il dismiss per riga e «Segna tutte come lette»; il click apre il deep link e segna come letta.
- Il client aggiorna badge e centro con **polling ogni 60 secondi e al focus**. Il relay SSE `/events` di ADR-0010 nasce in M6, con lo streaming AI.
- Una notifica nuova aggiorna solo il badge, senza toast: i toast restano per l'esito delle azioni.
- In M3 non c'è una pagina Notifiche.
- La voce Impostazioni sta in fondo alla sidebar. Su telefono non entra nella bottom nav: ci si arriva dal piede del popover della campanella.

## Conseguenze

- **ADR-0004:**
  - la ricorrenza acquisisce fine mese, `seriesId`, occorrenze toccate ed eccezioni, e le regole di split, aggiunta e rimozione;
  - `reminderOffsetMinutes` lavora con `reminderMode`;
  - la board e Oggi raggruppano per serie.
- **ADR-0006:**
  - l'overdue ha un thread per serie;
  - i default degli offset sono in NotificationSettings e c'è «Nessun promemoria»;
  - il dispatcher è pg-boss, e la consegna in-app usa il polling fino a M6.
- **ADR-0023:** la topbar ha la campanella.
- **ADR-0028:** la board applica la regola delle serie e raggruppa i ritardi come Oggi.
- **Roadmap M3:** le preferenze sono gli offset; la demo è «cambio l'offset e la notifica si sposta», non «disattivo una preferenza».
- **M5:** il binding Habit può puntare al `seriesId`, senza migrazione.

## Alternative scartate

- **rrule.js:** gestione delle timezone fragile sul DST e manutenzione ferma.
- **rrule-temporal:** RFC completo e polyfill Temporal per un subset di sette campi.
- **Saltare i mesi senza il giorno (RFC 5545):** perde occorrenze che l'utente intende come «fine mese».
- **Lo split senza identità di serie, o con un link al predecessore:** M5 dovrebbe risalire una catena o migrare i dati.
- **La serie sovrascrive le eccezioni:** perde una modifica fatta a mano.
- **Auto-skip delle occorrenze perse:** nasconde le occasioni mancate (ADR-0004).
- **Un overdue per occorrenza:** una serie giornaliera ignorata accumula un segnale al giorno.
- **Promemoria e overdue della stessa occorrenza attivi insieme:** due segnali per lo stesso fatto.
- **Una card per ogni ritardo nella board:** sette card per una serie giornaliera ignorata da una settimana.
- **Spostare tutti i giorni di una serie settimanale dello stesso scarto:** lun/mer/ven diventerebbe mar/gio/sab per aver spostato un solo giorno.
- **Interruttori in-app per tipo di trigger:** viola l'invariante 1 di ADR-0006.
- **Job di riconciliazione al posto dell'outbox:** Notifications leggerebbe Task, e M5 avrebbe comunque bisogno dell'outbox.
- **Scrivere la richiesta nella transazione del Task:** due aggregate in una transazione.
- **SSE subito:** infrastruttura da provare per un ritardo di un minuto che ai promemoria non pesa.
- **Toast per ogni notifica:** compete con i toast delle azioni.
