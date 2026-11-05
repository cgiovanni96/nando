# 0019 — Habits: forza dell'abitudine

- **Stato:** accettato
- **Data:** 2026-11-04
- **Ticket:** NAS-129 — Habits: forza dell'abitudine
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0014, ADR-0015

## Contesto

ADR-0014 ha fissato lo score di un Habit come valutazione **binaria** del periodo: `met`, `missed`, `paused` o `not_evaluated`; il progresso parziale è mostrato separatamente e non è uno score. La scelta resta corretta per confrontare habit diversi e comporre gli aggregati per Area e globale.

Loop Habit Tracker mostra però un secondo segnale che Nando non ha: una **forza** continua, che premia la consistenza recente e non azzera un habit dopo una settimana storta. Un habit mensile con target 3 che totalizza 2 evidenze ogni mese vale zero nell'aggregato di Nando, anche se l'utente non ha mai smesso. La forza risponde a una domanda diversa dallo score: «sto costruendo l'abitudine?» invece di «ho rispettato il periodo?».

NAS-60 deve mostrare uno storico per habit. Senza una metrica continua, lo storico rischia di essere una fila di stati binari o, peggio, una griglia di giorni che il modello per periodo ha esplicitamente escluso. La forza rende il grafico utile senza cambiare il modello di valutazione.

## Decisione

### Cosa è

- `Habit strength` è una metrica **derivata** per Habit, in `[0, 1]`, mostrata in UI come 0–100.
- Misura la consistenza recente: cresce con le evidenze, decade con i giorni scoperti.
- **Non è lo score del periodo**, non è uno stato del periodo e **non entra** negli aggregati per Area o globale.
- È l'unico dato continuo dello storico; lo score resta binario e resta la base degli aggregati.

### Finestra e formula

La formula riprende quella di Loop, adattata alla granularità di Nando.

```text
W = 1 (giorno) | 7 (settimana) | 30 (mese) | 365 (anno)
f = target / W
m = 0.5^(sqrt(f) / 13)
c(t) = min(1, evidenze non rettificate in (t-W, t] / target)
S(t) = S(t-1) * m + c(t) * (1 - m)
```

- `W` è la lunghezza della finestra mobile in giorni. Per il mese si usa **30 giorni** e per l'anno **365**, non la lunghezza del periodo di calendario: la forza è un trend, non una valutazione di periodo.
- `target` è quello della `HabitConfigVersion` vigente nel periodo di `t`.
- `S` parte da `0` nel primo giorno del primo periodo **valutato**.
- La finestra è **mobile** e non si azzera al confine di calendario. Per questo la forza può restare alta mentre il periodo corrente è ancora `0/3`: la finestra contiene ancora le evidenze del periodo precedente.
- `m` è il fattore di decadimento; l'emivita scala con la frequenza. Un habit giornaliero ha emivita ~13 giorni, uno settimanale con target 3 ~20 giorni, uno mensile con target 3 ~41 giorni.
- `target >= 1`: un target 0 renderebbe `c` indefinito e il periodo sempre `met`; non è un habit valutabile in v1. Per `at_most` con target 0 si veda ADR-0020, dove la forza è binaria.

### Neutri e storia

- **Pausa**: nei giorni coperti da una pausa `S` resta invariata, senza decadimento. Le evidenze registrate durante la pausa **contano** nella finestra: la pausa sospende il giudizio, non cancella un'azione vera.
- **Periodi parziali**: il periodo di nascita e il periodo di archivio sono `not_evaluated` (ADR-0014). La serie non parte prima del primo periodo valutato e si ferma all'archivio.
- **Archivio**: la serie termina. Alla riattivazione riparte da `0` nel primo periodo valutato; un habit archiviato per un anno non conserva una forza che non ha più.
- **Rettifiche**: un'evidenza rettificata esce dalla finestra e la serie si ricalcola dal giorno interessato. La forza è derivata: si aggiorna, non è un fatto congelato. È diverso dal periodo, che resta storico.
- **Cambio configurazione**: ogni giorno usa la versione vigente per quel periodo. Un cambio di target o granularità vale dal periodo successivo (ADR-0014) e non riscrive i giorni passati; il grafico marca il punto di cambio.
- **Timezone e DST**: giorni e finestra si calcolano nella timezone dell'habit. Un giorno di cambio ora dura 23 o 25 ore e non sposta le evidenze.

### Derivazione e performance

- Nessuna tabella, nessuno snapshot: la forza si calcola **on read** dalla configurazione, dal tempo e dalle evidenze non rettificate.
- Indice `(habitId, occurredAt)` oltre a `(habitId, periodKey)` già previsto da ADR-0014.
- Per il grafico si espone:
  - `strengthAtEnd(periodKey)` — valore nell'ultimo giorno del periodo chiuso;
  - `strengthNow` — valore di oggi, provvisorio, per il periodo aperto.
- Il calcolo di una serie giornaliera usa una finestra scorrevole con due puntatori; il costo è lineare nei giorni richiesti, non nel numero di evidenze per giorno.

### UI

- La forza è **secondaria**: lo score del periodo resta il numero principale.
- Va etichettata come **trend**, non come valutazione. Testo di supporto: «La forza misura la costanza recente; lo score misura il periodo.»
- Il grafico di NAS-60 è per periodo, con la linea di forza sovrapposta e campionata a fine periodo. Non diventa una griglia di giorni.
- La forza non compare negli aggregati di Area o globale e non sostituisce lo score nella dashboard.

## Esempio numerico

Un periodo mancato non azzera la forza.

- **Habit giornaliero, target 1** (`m ≈ 0,948`): dopo 7 giorni scoperti una serie perfetta scende a `0,948^7 ≈ 0,69`, non a zero.
- **Habit settimanale, target 3** (`m ≈ 0,966`): dopo una settimana scoperta scende a `0,966^7 ≈ 0,78`; dopo tre settimane a `0,966^21 ≈ 0,48`.
- **Habit mensile, target 3** (`m ≈ 0,9833`): dopo un mese scoperto scende a `0,9833^30 ≈ 0,60`; dopo due mesi a `0,9833^60 ≈ 0,36`.

All'inizio del periodo successivo la forza è ancora quella maturata nel periodo precedente, poi scende man mano che il periodo passa senza evidenze. Per questo un periodo può chiudersi `missed` con una forza non azzerata: la forza dice che l'abitudine è stata forte fino a poco prima; lo score dice che quel periodo non ha rispettato il target.

## Schema concettuale

```text
Habit
  configVersion(t) -> target, granularity, timeZone
  evidence(e)      -> occurredAt, rectifiedBy?

strength(t) = EMA(
  W      = 1 | 7 | 30 | 365,
  target = configVersion(t).target,
  c(t)   = min(1, count(evidence in (t-W, t]) / target)
)

strengthAtEnd(period) = strength(last day of period)
strengthNow           = strength(today)   // provvisorio
```

## Invarianti

1. `strength` è in `[0, 1]`.
2. `strength` non è lo score del periodo e non entra negli aggregati per Area o globale.
3. I giorni in pausa non fanno decadere la forza; le evidenze durante la pausa contano.
4. I periodi parziali di nascita e archivio non avviano e non estendono la serie.
5. Una rettifica ricalcola la serie dal giorno interessato.
6. Un cambio di configurazione vale dal periodo successivo e non riscrive i giorni passati.
7. La forza è derivata: nessuna tabella, nessuno snapshot.
8. Il grafico campiona la forza a fine periodo; il periodo corrente è provvisorio.
9. L'archivio termina la serie; la riattivazione riparte da zero.
10. Giorni e finestra usano la timezone dell'habit e sono DST-safe.

## Conseguenze

- **NAS-60:** il grafico per periodo mostra la linea di forza; l'etichetta e il tooltip distinguono forza e score.
- **NAS-62:** un widget può mostrare una mini-trend di forza, ma non il numero globale.
- **ADR-0014:** nessuna modifica a score, pause o aggregati; si aggiunge l'indice `(habitId, occurredAt)`.
- **ADR-0015:** le rettifiche alimentano anche la forza; nessuna modifica allo schema delle evidenze.
- **Glossario:** entrano **Habit strength** e **Period score**.
- **Test:** formula, pausa, periodi non valutati, rettifica, cambio configurazione, timezone/DST, archivio, serie vuota.

## Alternative scartate

- **Sostituire lo score binario con la forza:** perde confrontabilità e aggregati; la forza non è comparabile tra granularità diverse perché il decadimento scala con la frequenza.
- **Usare la forza negli aggregati:** un habit mensile e uno giornaliero con la stessa forza non significano la stessa cosa; il numero globale diventerebbe opaco.
- **Materializzare la forza giornaliera:** una seconda verità da tenere allineata; la derivazione on read basta.
- **Finestra allineata al periodo di calendario:** azzera la forza a ogni inizio periodo e punisce gli habit a bassa frequenza; la finestra mobile è il punto.
- **Emivita fissa per tutti gli habit:** un habit mensile decadrebbe troppo in fretta tra un check-in e l'altro; l'emivita scalata alla frequenza è l'idea di Loop che vale la pena tenere.
- **Inizializzare a 1 o al primo `c`:** nasconde la fase di costruzione; la forza parte da zero e cresce.
- **Contare solo le evidenze manuali:** ignorerebbe i binding ai Task, che sono il valore aggiunto di Nando.
- **Contare le evidenze rettificate:** falsa la storia.
