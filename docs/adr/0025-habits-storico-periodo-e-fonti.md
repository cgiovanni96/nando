# 0025 — Habits: storico per periodo, forza e fonti attive

- **Stato:** accettato
- **Data:** 2026-11-09
- **Ticket:** NAS-60 — Habits: UI fonti attive / storico / periodo
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0014, ADR-0015, ADR-0019, ADR-0023
- **Chiarisce:** ADR-0023 (la griglia giornaliera resta evidenza, non score)

## Contesto

NAS-60 chiede il dettaglio della schermata Habit: fonti attive separate dalla storia, progresso del periodo separato dallo score binario, pausa e storico delle evidenze. I criteri accettati il 2026-11-04 aggiungono lo storico per periodo, la forza come linea sovrapposta, la streak in periodi e giorni, gli stati di nascita/archivio/configurazione e il contratto derivato `GET /habits/:id/history`.

NAS-62 ha già consegnato la shell e un primo mock Habit in `docs/mock/`: griglia giornaliera delle evidenze, score per periodo, calendario annuale e forza prevista da ADR-0019 ma non ancora disegnata. Il dettaglio era incompleto: niente celle di periodo, niente linea di forza, streak come stringa statica, fonti attive assenti, rettifiche non rappresentate.

Questo ADR registra le decisioni della UI e del read model. L'artefatto è il prototipo in `docs/mock/`, non codice di produzione.

## Decisione

### Gerarchia della schermata

La lista Habit e il dettaglio hanno due lavori diversi:

- **Lista Habit:** evidenze giornaliere e stato del periodo corrente. Sopra 1320 px mostra la griglia a 31 giorni; sotto, la stessa evidenza è una griglia a 7 giorni. Nessuno scroll orizzontale.
- **Dettaglio Habit:** quattro blocchi in ordine fisso:
  1. testata con obiettivo, granularità, timezone e azioni;
  2. riepilogo del periodo corrente (progresso, score, forza, streak);
  3. storico per periodo;
  4. fonti attive e storico delle evidenze.

La griglia giornaliera della lista non è lo score: mostra le evidenze. Lo score vive nel periodo e nel dettaglio. La distinzione è resa esplicita dalla copy e dai titoli.

### Storico per periodo

- Una **cella per periodo**, non una griglia di giorni. La granularità è quella dell'habit: giorno, settimana ISO, mese di calendario, anno.
- La finestra è di **21 periodi per gli habit giornalieri** e **12 per settimana, mese e anno**. Il periodo corrente è l'ultima cella; i precedenti sono chiusi. Il limite è una scelta di densità, non di dominio: il contratto accetta un parametro.
- Gli stati visibili sono `met`, `missed`, `paused`, `not_evaluated`; il periodo corrente usa lo stato di lettura `open` (in corso), che **non è uno score definitivo**. Un periodo aperto che ha già toccato il target resta `open` e mostra il progresso separato.
- L'asse è **ordinale**: una cella per periodo, non proporzionale alla durata. Un cambio di granularità crea un segmento con la propria etichetta; le celle non diventano un asse temporale continuo.
- Un **cambio di configurazione** è marcato da una barra verticale tratteggiata sopra la prima cella della nuova versione. Il target della cella è quello della versione vigente.
- Una **pausa** è una cella tratteggiata con `Ⅱ`; il tooltip indica l'intervallo. Un periodo intersecato da una pausa è neutro (ADR-0014).
- Il periodo di nascita e il periodo di archivio sono `not_evaluated`; non sono fallimenti.
- Ogni cella ha un'etichetta accessibile con periodo, stato, evidenze, obiettivo, forza e pausa. I dati sono ripetuti in una tabella `Dati dello storico`, così lo stato non dipende dal colore.
- Le celle non sono interattive: il dettaglio delle evidenze si apre dal calendario delle registrazioni. Questo evita un secondo flusso di navigazione dentro lo storico.

### Forza

- La forza è una **linea sovrapposta** alle celle, con scala 0–100, campionata a fine periodo. Il periodo corrente ha un punto provvisorio, tracciato con un anello vuoto.
- È **secondaria**: lo score del periodo resta il numero principale. La copy dice «La forza misura la costanza recente; lo score misura il periodo».
- È calcolata **on read** con la formula di ADR-0019, giorno per giorno, usando la configurazione vigente e le evidenze non rettificate. Nessuna tabella, nessuno snapshot.
- Se non esiste un periodo valutato, la forza è `—` e la linea non compare. Non si mostra uno zero che sembrerebbe un giudizio.
- I giorni in pausa non fanno decadere la forza; le evidenze durante la pausa contano nella finestra. La linea può restare piatta durante una pausa.
- Un cambio di target o granularità non riscrive i campioni passati: il campione di ogni periodo usa la versione vigente a fine periodo.

### Streak

- La streak conta **periodi chiusi consecutivi `met`** camminando all'indietro dal più recente periodo chiuso.
- `paused` e `not_evaluated` si **saltano**: non contano come periodi e non rompono la serie.
- I **giorni** sono i giorni di calendario dall'inizio del primo periodo `met` alla fine dell'ultimo periodo `met`, inclusi. Pause e periodi non valutati dentro l'intervallo entrano nel conteggio dei giorni, non in quello dei periodi.
- La UI mostra:
  - per settimana/mese/anno: `4 mesi · 122 giorni`, con `dal 1 giugno`;
  - per giorno: `6 giorni`, con `dal 22 ottobre`.
- Il tooltip distingue `giorni valutati`, `giorni in pausa` e `giorni non valutati`.
- Il periodo corrente aperto non entra nella streak finché non si chiude. Un periodo corrente già al target è `provvisorio`, non un risultato.

### Fonti attive

- Le fonti sono **regole**, non fatti: stanno in un pannello separato dallo storico delle evidenze.
- Gruppi: **Attive**, **Spente**, **Chiuse**. Le chiuse stanno in `Storico fonti`; le spente restano visibili perché sono riattivabili.
- Ogni riga mostra il task o la serie, la ricorrenza se presente, lo stato e la data. La riga apre il task quando esiste ancora.
- Azioni ammesse: `Disattiva` su una fonte attiva, `Riattiva` su una spenta. Una fonte chiusa non si riattiva: è terminale (ADR-0015).
- Le fonti si creano dal task, non da questa schermata. Il prototipo non offre un pulsante «Aggiungi fonte».
- Se non ci sono fonti attive: `Nessuna fonte attiva` e la nota che il check-in manuale resta disponibile.
- Il **check-in** propone le attività collegate attive. Sceglierne una produce un'evidenza con `provenance = task` e lo stesso `activityId` dell'attività; `Altra azione` produce un'evidenza manuale. Se non ci sono fonti attive, il check-in manuale parte direttamente.
- Il prototipo non completa il task quando si sceglie l'attività: registra un'evidenza. Il completamento del task resta del modulo Tasks.

### Evidenze e rettifiche

- Le evidenze sono **fatti**: restano visibili anche quando rettificate. La rettifica mostra motivo e `non conta nello score`; non cancella la riga.
- Il calendario delle registrazioni usa il giorno come unità:
  - sopra 1320 px mostra l'anno;
  - sotto 1320 px mostra le ultime 12 settimane.
- Il giorno si apre in un drawer con provenienza (`Check-in manuale`, `Task collegato`, `Evento Space`, `Origine non disponibile`), orario, descrizione e link al task.
- Le evidenze precedenti allo storico dettagliato mostrano `Origine non disponibile`; non vengono inventate provenance.
- Una cella con evidenze rettificate ha un bordo puntinato e il conteggio nel tooltip. Il numero sulla griglia è il fatto; lo score usa solo le evidenze non rettificate.
- Il check-in dal drawer è disponibile solo per oggi. Un giorno passato non offre un'azione che potrebbe contraddire le regole sulle evidenze retroattive.

### Stati

| Stato | Cosa mostra la UI |
| --- | --- |
| Nuovo habit, periodo parziale | `Non valutato`, primo periodo utile, forza `—`, nessuna serie, check-in disabilitato |
| Periodo corrente aperto | progresso `2/3`, score `In corso`, forza provvisoria, streak dei periodi chiusi |
| Tutti i periodi raggiunti | celle `met`, streak piena, forza campionata |
| In pausa | banner, celle `paused`, score `In pausa`, check-in disabilitato, serie non interrotta |
| Archiviato | banner, nessun periodo corrente, ultimo periodo valutato, fonti chiuse, nessun check-in |
| Cambio configurazione | barra verticale, target della nuova versione, avviso della configurazione futura |
| Nessun periodo valutato | empty state nello storico, forza `—`, streak `Nessuna serie` |

### Responsive e accessibilità

- Breakpoint di riferimento: **390** e **1440**. La lista passa da 31 a 7 giorni sotto **1320 px**; il calendario annuale passa alle ultime 12 settimane sotto **1320 px**.
- Lo storico a 21 celle sta in 350 px: celle da circa 16 px, etichette ogni tre giorni (le altre restano nei tooltip e nella tabella). Nessuno scroll orizzontale.
- I controlli (check-in, configurazione, fonti, drawer) mantengono aree di tocco da 44 px.
- Lo stato non è mai solo colore: icone `✓`, `—`, `Ⅱ`, `·`, `○`, etichette e tooltip. La tabella dei dati è il fallback testuale.
- La linea di forza è decorativa ma ha una legenda e i valori nella tabella; non è l'unico modo per leggere i dati.
- `prefers-reduced-motion` è rispettato. Il focus torna al trigger dopo la chiusura di dialoghi e drawer.

### Contratto derivato

Il dettaglio usa due letture. Entrambe sono derivate; nessuna tabella di periodi, nessuno snapshot.

```text
GET /habits/:id
{
  id, name, area, state, createdAt, archivedAt,
  granularity, target, timeZone,
  currentPeriod: { periodKey, startsAt, endsAt, state, evidenceCount, target } | null,
  streak: { periods, days, from, to, evaluatedDays, pausedDays, notEvaluatedDays },
  pauses: [{ id, from, to }],
  sources: [{
    id, taskId, taskTitle, targetKind: 'task' | 'series',
    state: 'active' | 'disabled' | 'closed',
    recurrence?, createdAt, closedAt, closeReason?
  }]
}

GET /habits/:id/history?periods=12
{
  habitId, generatedAt, granularity, timeZone,
  periods: [{
    periodKey,            // 2026-10-28 | 2026-W44 | 2026-10 | 2026
    granularity: 'day' | 'week' | 'month' | 'year',
    startsAt, endsAt,
    state: 'met' | 'missed' | 'paused' | 'not_evaluated',
    evidenceCount, target,
    strength: 0..100 | null,
    configVersionId,
    pause: { from, to } | null
  }],
  current: {
    periodKey, granularity, startsAt, endsAt,
    state: 'open' | 'paused' | 'not_evaluated',
    evidenceCount, target,
    strength: 0..100 | null,
    strengthProvisional: true,
    configVersionId,
    pause: { from, to } | null
  } | null,
  streak: { periods, days, from, to, evaluatedDays, pausedDays, notEvaluatedDays },
  configVersions: [{
    id, effectiveFrom, effectiveFromPeriod,
    target, granularity, timeZone
  }],
  pauses: [{ id, from, to }]
}
```

- `periods` è il numero totale di celle richieste, periodo corrente incluso. Default 12, minimo 1, massimo 60. La UI giornaliera chiede 21.
- `strength` è un intero 0–100, campionato a fine periodo; sul periodo corrente è la forza di oggi ed è marcata `strengthProvisional`.
- `state` di un periodo chiuso usa i quattro stati di ADR-0014. `open` è uno stato di lettura del periodo corrente, non uno score e non entra negli aggregati.
- `from` e `to` della streak sono date ISO; `days` è inclusivo.
- `sources` sta in `GET /habits/:id`; lo storico non duplica le fonti.
- La route segue ADR-0022: schemi Zod condivisi, `describeRoute`, esempi dalle factory, `safeParse` nei test, `pnpm docs:check` come gate.

## Schema concettuale

```text
Habit
  ├─ ConfigVersion ── target, granularity, timeZone, effectiveFromPeriod
  ├─ Pause ───────── from, to
  ├─ Source ──────── task | series, active | disabled | closed
  └─ Evidence ────── day, periodKey, provenance, rectifiedBy?

History (derivata, on read)
  ├─ periods[]      una cella per periodo chiuso
  ├─ current        periodo aperto, provvisorio
  ├─ streak         periodi met + giorni di calendario
  └─ strength[]     campioni 0–100 a fine periodo
```

## Invarianti

1. Lo score è binario e vive nel periodo chiuso; `open` non è uno score.
2. La forza non è lo score e non entra negli aggregati di Area o globale.
3. Lo storico è una cella per periodo, mai una griglia di giorni che finge di essere score.
4. Un cambio di configurazione vale dal periodo successivo e non riscrive lo storico.
5. Un periodo in pausa è neutro; la streak lo salta ma i giorni restano nel conteggio.
6. Le fonti sono regole, le evidenze sono fatti: la UI non le mescola.
7. Una rettifica resta visibile ma non conta nello score.
8. Forza, periodi e streak sono derivati; nessuno snapshot, nessuna tabella `HabitPeriod`.
9. A 390 e 1440 non c'è scroll orizzontale; i controlli restano a 44 px.
10. Lo stato è leggibile senza colore, con icone, etichette e tabella.

## Conseguenze

- **ADR-0023:** chiarito. La griglia giornaliera resta la vista delle evidenze; lo storico per periodo è la vista della valutazione. La lista Habit usa 31 giorni sopra 1320 px e 7 giorni sotto.
- **ADR-0014/0015/0019:** nessuna modifica al modello. La UI rende visibili versione, pausa, rettifica e forza già decise.
- **NAS-53:** la roadmap può partire; il blocco NAS-60 è chiuso.
- **Mock:** `habit-model.js` contiene dati e derivazioni; `habit-analytics.js` contiene il dettaglio; la chiave di persistenza è `nando-prototype-v2`. `LEGGIMI.md` e `design.html` sono aggiornati.
- **Implementazione:** la route di lettura e la schermata vanno costruite secondo ADR-0022. La derivazione va testata su: formula della forza, pausa, periodi non valutati, rettifica, cambio configurazione, timezone/DST, archivio, serie vuota, streak con pause.
- **Glossario:** `Habit strength` e `Period score` restano le definizioni; non serve un nuovo termine per lo storico.
- **Fuori v1.1:** obiettivi numerici e di astensione (ADR-0020) non entrano in questa UI.

## Alternative scartate

- **Solo grafico, senza celle di periodo:** non rende leggibili gli stati `met`, `missed`, `paused`, `not_evaluated` senza colore.
- **Griglia giornaliera come storico di valutazione:** confonde evidenze e score; ADR-0014 lo esclude.
- **Forza come numero principale:** sposta l'attenzione dal periodo e rende incomparabili habit con granularità diverse.
- **Snapshot della forza o tabella dei periodi:** una seconda verità da tenere allineata; la derivazione on read basta.
- **Fonti e evidenze nello stesso elenco:** non rende ovvio cosa è trigger e cosa è storia.
- **Asse temporale proporzionale con granularità miste:** una cella per periodo è più onesta e sta a 390 px.
- **Scroll orizzontale per 31 giorni o per l'anno:** viola il vincolo a 390 px.
- **Modifica della granularità nel prototipo:** il modello la supporta, ma il mock esercita solo il cambio di target; la modifica della granularità richiede una UI e una migrazione dedicate.
- **Riattivazione dell'habit archiviato nel prototipo:** lo stato è visibile; l'azione richiede una decisione sul riavvio della serie e resta fuori.

## Questioni aperte

- La finestra 21/12 è la densità giusta o serve un selettore di intervallo?
- La barra del cambio configurazione è abbastanza visibile a 21 celle, o serve un'etichetta testuale sopra il segmento?
- La lista Habit deve mantenere la griglia a 31 giorni sopra 1320 px o passare sempre a 7 giorni?
- La riattivazione di un habit archiviato e la modifica della granularità: ADR dedicato o dettaglio implementativo?
- La UI di ricorrenza e skip/cancel dei task resta fuori da NAS-60; va trattata nell'implementazione Tasks.
