# 0014 — Habits: periodi, obiettivi, score, streak e pause

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-61 — Habits: periodi, obiettivi, score, streak, pause
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Il handoff ha già quattordici decisioni confermate su Habits: periodi valutati **binariamente** con il progresso parziale mostrato separatamente, pause neutrali, modifiche efficaci dal periodo successivo senza riscrivere la storia, score globale come **media degli habit**, evidenze in uno storico unificato, deduplicazione per identità dell'attività, trigger solo da associazioni esplicite. Nessuna di queste è in discussione qui.

Restava l'algoritmo: quali finestre, come si contano le evidenze, cosa rompe una streak, come habit con periodi diversi finiscono nello stesso numero, e cosa succede ai periodi parziali. Sono le voci che il handoff elencava come `[A]` e che NAS-63 non può assumere senza inventarle.

## Decisione

### Granularità

- Ogni habit scegle tra **giorno, settimana ISO (lunedì–domenica), mese di calendario e anno**, nella propria timezone.
- Frequenza libera ("ogni 10 giorni") **fuori v1**: habit non allineati renderebbero aggregati e streak incomparabili.
- L'obiettivo misura **solo un conteggio di evidenze** con target intero ("3 al mese", "8 al giorno"). Durata e metriche con unità libera fuori v1: un'evidenza vale 1.

### Periodi derivati, non materializzati

- Un periodo è `[startsAt, endsAt)` calcolato nella timezone della **versione di configurazione vigente**; l'evidenza porta con sé il `periodKey` risolto quando nasce (`2026-10-28`, `2026-W44`, `2026-10`, `2026`) e il periodo dell'evidenza non si muove più, nemmeno se la timezone cambia.
- **Nessuna tabella `HabitPeriod`**: il periodo è una funzione pura di configurazione, tempo e timezone. Materializzarlo duplicherebbe una verità derivabile e imporrebbe un ricalcolo a ogni cambio di timezone o di granularità.
- `HabitConfigVersion(habitId, target, granularity, timeZone, effectiveFromPeriod)`: un cambio vale **dal periodo successivo**, mai retroattivo e mai una riscrittura dei risultati storici.

### Score

- `evidenceCount` = evidenze non rettificate con `occurredAt` dentro il periodo.
- Stato di un periodo: `paused` se una pausa lo interseca; `not_evaluated` se è parziale; `met` se `evidenceCount >= target`; `missed` altrimenti.
- **Progresso parziale separato**: il periodo aperto mostra `2/3` e diventa `met` appena tocca il target, ma lo score resta **provvisorio** finché il periodo non si chiude. Le streak contano solo periodi chiusi: un progresso parziale non è un risultato.

### Evidenze manuali e deduplicazione

- **Ogni check-in manuale è un'evidenza distinta**, con `activityId` nuovo: due azioni vere nello stesso giorno sono due, e un habit giornaliero con target 8 è raggiungibile.
- La deduplicazione vale solo per la **stessa attività esterna**: lo stesso task o evento completato due volte resta una sola evidenza, per l'unicità `(habitId, activityId, periodKey)` di ADR-0003.

### Streak

- **Periodi chiusi consecutivi con stato `met`**, camminando all'indietro dal più recente chiuso.
- `paused` e `not_evaluated` si saltano: non contano e **non rompono**.
- Il periodo in corso non rompe la serie finché non si chiude sotto target.
- La streak è per habit, non globale. Esempi: giornaliero raggiunto il 20, 21, pausa 22–23, raggiunto 24–27 → **6**; mensile con settembre sì, ottobre in pausa, novembre sì → **2**.

### Pause

- Una pausa ha data di inizio e fine. **Ogni periodo che interseca la pausa è neutro**, anche se la pausa copre solo tre giorni del mese: il modello mentale è "in pausa non ti giudico".
- Un periodo in pausa esce da numeratore e denominatore degli aggregati: **non vale zero**.
- Pausa e archivio sono **due stati distinti**: la pausa sospende il giudizio, l'archivio chiude l'habit. Un habit archiviato non genera nuovi periodi, conserva la storia, esce dagli aggregati, e se riattivato riparte dal periodo corrente senza inventare quelli saltati.

### Periodi parziali

- Il periodo in cui un habit nasce è **`not_evaluated`** a meno che non parta dal primo giorno del periodo.
- Lo stesso per il periodo in cui viene archiviato: si chiude neutro, non come fallimento.
- Conseguenza esplicita: un habit creato il 28 novembre con target mensile 3 non ha un novembre fallito, e un habit giornaliero creato alle 18 non deve fare il check-in del giorno stesso.

### Aggregati per Area e globale

- **Finestra**: l'ultimo mese di calendario concluso.
- Per ogni habit attivo: rapporto `periodi met / periodi valutati` dentro la finestra. Periodi in pausa e non valutati esclusi da entrambi i lati.
- Un periodo **più lungo della finestra** (mensile o annuale) entra con `min(1, evidenceCount / target)` del periodo corrente, marcato **provvisorio**: senza questo, un habit annuale non contribuirebbe per undici mesi.
- **Area** = media semplice dei rapporti degli habit nei suoi Space discendenti (ADR-0002). **Globale** = media semplice dei rapporti di tutti gli habit, non delle Aree: un'Area con dieci habit non pesa dieci volte.
- Un habit senza periodi valutati nella finestra esce dal denominatore invece di valere zero.

### Esempio numerico

Ottobre 2026, ultimo mese concluso.

| Habit | Periodo | Ottobre | Rapporto |
| --- | --- | --- | --- |
| Meditare | giorno, target 1 | 25 giorni raggiunti su 31 | 0,806 |
| Palestra | settimana, target 3 | 3 settimane su 4 (quelle che iniziano a ottobre) | 0,750 |
| 3 acts of love | mese, target 3 | 4 evidenze | 1,000 |
| Sonno | giorno, target 1 | in pausa dal 15 | escluso |

Globale = (0,806 + 0,750 + 1,000) / 3 = **0,852**.

Se "Sonno" non fosse in pausa e avesse 20 giorni su 31, entrerebbe con 0,645 e il globale scenderebbe a 0,800. La pausa esce dal denominatore: non è uno zero, è un'assenza.

### Timezone e DST

- La timezone è **dell'habit**, non globale.
- I confini dei periodi si calcolano nella timezone della versione vigente: un giorno di cambio ora dura 23 o 25 ore e le evidenze restano nel giorno giusto.
- Cambiare timezone è un cambio di versione, efficace dal periodo successivo; i `periodKey` già assegnati non si spostano.

### Fuori v1

- Habit negativi o di astensione ("non fumare"), che richiederebbero un obiettivo inverso.
- Obiettivi con durata o unità libera.
- Snapshot materializzati dello score: in v1 lo score è **derivato**, con indice su `(habitId, periodKey)`. Se la lettura diventa lenta, si aggiunge una proiezione, non una seconda verità.

## Schema concettuale

```text
Habit
  id, spaceId, name, state (active | paused | archived), createdAt

HabitConfigVersion
  id, habitId, target, granularity (day|week|month|year), timeZone,
  effectiveFromPeriod          // periodo successivo all'edit

HabitPause
  id, habitId, from, to        // un periodo intersecato è neutro

HabitEvidence
  id, habitId, activityId, periodKey, occurredAt, provenance, rectifiedBy?
  unique(habitId, activityId, periodKey)

Derivati (nessuna tabella)
  periodo     = f(configVersion, timeZone, istante)
  score       = met | missed | paused | not_evaluated
  progresso   = evidenceCount / target, provvisorio se aperto
  streak      = periodi chiusi met consecutivi, pause saltate
  area/globale = media dei rapporti sulla finestra mensile
```

## Invarianti

1. Un periodo si valuta in modo binario; il progresso parziale non è uno score.
2. Un fatto conta una volta: la stessa attività non produce due evidenze nello stesso periodo.
3. Due azioni distinte nello stesso giorno sono due evidenze.
4. Un cambio di configurazione non riscrive un periodo passato.
5. Un'evidenza non cambia periodo: il suo `periodKey` è fissato alla nascita.
6. Una pausa non è un fallimento e non è un successo: esce dal conteggio.
7. Un periodo parziale non è valutato.
8. Una streak ignora pause e periodi non valutati, e non si rompe per un periodo ancora aperto.
9. Il globale è la media degli habit, mai la media delle Aree.
10. Lo score è derivato: nessuna tabella di periodi, nessuno snapshot in v1.

## Conseguenze

- **NAS-63:** binding, evidenze e rettifiche operano su `HabitEvidence` con `periodKey` già risolto; la revoca di un'evidenza è una rettifica, non una cancellazione.
- **NAS-60:** la UI mostra progresso parziale separato dallo score, fonti attive separate dalla storia, pausa come stato e non come assenza.
- **NAS-62:** gli aggregati per Area e globale hanno una finestra e una composizione dichiarate, quindi la dashboard può mostrarli senza ricalcolare regole.
- **ADR-0003:** l'unicità per `(habitId, activityId, period)` diventa `(habitId, activityId, periodKey)`; il periodo non è una FK.
- **ADR-0011:** `HabitConfigVersion` e `HabitPause` sono stato corrente versionato; le evidenze restano append-only con rettifica.
- **ADR-0013:** il flusso Habits è obbligatorio; questo algoritmo è il suo criterio di fatto misurabile.
- **Roadmap:** Habits dipende dai completamenti di Tasks, quindi non può precederli.

## Alternative scartate

- **Solo periodo mensile:** algoritmo e aggregati banali, ma un habit quotidiano diventa un obiettivo mensile e la streak perde significato.
- **Intervallo libero:** habit non allineati, aggregati che confrontano finestre diverse e streak che non coincidono con nulla.
- **Durata o metrica libera:** richiede durata su ogni evidenza e una UI che la chieda, e toglie semantica al target.
- **Tabella `HabitPeriod` materializzata:** duplica una verità derivabile e impone ricalcoli a ogni cambio di timezone o granularità.
- **Snapshot dello score:** una seconda verità da mantenere allineata, per una lettura che un indice risolve.
- **Una sola evidenza manuale al giorno:** rende irraggiungibile qualunque target giornaliero maggiore di 1.
- **Pausa solo su periodi interi:** non puoi fermarti dal 15 al 30.
- **Pausa come zero:** punisce chi si ferma per scelta e rende il numero falso.
- **Archivio come pausa illimitata:** un habit abbandonato non si distingue da uno in vacanza.
- **Primo periodo valutato normalmente:** un habit mensile creato il 28 nasce fallito.
- **Aggregati per granularità separati:** nessun numero ambiguo, ma "score globale" smette di essere uno.
- **Globale come media delle Aree:** un'Area con dieci habit pesa dieci volte.
