# 0020 — Habits: obiettivi numerici e di astensione

- **Stato:** proposto
- **Data:** 2026-11-04
- **Ticket:** NAS-130 — Habits v1.1: obiettivi numerici e di astensione
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0014, ADR-0015, ADR-0019
- **Nota:** decisione per v1.1; non modifica il modello v1.

## Contesto

ADR-0014 limita l'obiettivo a un **conteggio intero di evidenze**: un'evidenza vale 1, il target è un intero, e durata, unità libera e habit negativi o di astensione sono esplicitamente fuori v1. La scelta tiene semplice lo score e gli aggregati, ma lascia fuori casi comuni: «8 bicchieri d'acqua», «al massimo 2 caffè», «non fumare», «30 minuti di lettura». Loop Habit Tracker li copre da anni con un modello numerico: un valore per entry, un target `at_least` o `at_most`, un'unità, e una somma per periodo.

Questo ADR è **proposto** e pianifica v1.1. Non introduce campi o comportamenti in v1 e non richiede di modificare ADR-0014 o ADR-0015 ora: le clausole supersedute sono elencate sotto.

## Decisione

### Tipo di habit

- `Habit.kind`: `count` | `quantity`.
- `count` è il caso v1: ogni evidenza vale 1, target intero, solo `at_least`.
- `quantity` è il caso nuovo: ogni evidenza porta un valore numerico, il target è un numero decimale con unità, e il tipo di target può essere `at_least` o `at_most`.
- Un habit `count` è un `quantity` con `unit = count`, valore 1 e `at_least`; non ha un comportamento separato. Il campo `kind` esiste per la UI e per non chiedere un valore dove non serve.

### Configurazione

`HabitConfigVersion` si estende:

```text
HabitConfigVersion
  id, habitId
  targetType    (at_least | at_most)
  targetValue   (decimale >= 0)
  unit          (testo; "count" per kind = count)
  granularity   (day | week | month | year)
  timeZone
  effectiveFromPeriod
```

- `targetType` e `targetValue` sostituiscono il `target` intero di ADR-0014. Per compatibilità, un habit `count` legge `targetValue` come intero.
- `at_least` richiede `targetValue >= 1`; `at_most` ammette `targetValue = 0` per l'astensione totale.
- `unit` è obbligatoria per `quantity`, vuota o `count` per `count`.
- Il cambio di `targetType` o `unit` è un cambio di configurazione efficace dal periodo successivo, come ogni altro (ADR-0014).

### Evidenza

```text
HabitEvidence
  id, habitId, activityId, periodKey, occurredAt
  value          (decimale >= 0, default 1)
  provenance, sourceRef?, description?, rectifiedBy?
  unique(habitId, activityId, periodKey)
```

- `value` è il contributo dell'evidenza al periodo. Per `count` è sempre 1.
- `unit` non sta sull'evidenza: mescolare unità nello stesso habit renderebbe la somma priva di senso.
- Un'evidenza con `value = 0` non viene salvata: non è un fatto, è un no-op.
- La deduplicazione resta `(habitId, activityId, periodKey)`.

### Score del periodo

- `sumValue(period)` = somma dei `value` delle evidenze non rettificate con `periodKey` nel periodo.
- `at_least`: `met` se `sumValue >= targetValue`, altrimenti `missed`.
- `at_most`: `met` se `sumValue <= targetValue`, altrimenti `missed`.
- `paused` e `not_evaluated` restano quelli di ADR-0014.
- Progresso:
  - `at_least`: `sumValue / targetValue`, con cap a 1; il periodo aperto resta provvisorio.
  - `at_most`: si mostra `sumValue` contro `targetValue` come «consumato / consentito»; con `targetValue = 0` si mostra solo il consumo («2 consumati, limite 0»). Non si calcola un rapporto con denominatore zero.

### Semantica del check-in per at_most

Questo è il punto che cambia la UI, non solo il modello.

- Per `at_most` l'evidenza rappresenta **il consumo o il lapse**, non il successo. «Ho fumato 2» è un'evidenza con `value = 2`; «non ho fumato» è **assenza di evidenza**.
- Il check-in non si chiama «fatto»: si chiama «registra consumo» e chiede il valore. Un habit `at_most` senza evidenze nel periodo è `met` con `sumValue = 0`.
- Per `at_least` il check-in resta quello di v1: aggiunge un'evidenza con il valore scelto (default 1).
- Un habit `at_most` non mostra una spunta di successo: mostra il consumo corrente e il limite. La differenza è esplicita nella UI.

### Aggregati

- Gli aggregati restano **binari**: `periodi met / periodi valutati` nella finestra, come ADR-0014.
- Per un periodo più lungo della finestra, `at_least` entra con `min(1, sumValue / targetValue)`, provvisorio. `at_most` entra **binario**: un periodo che ha superato il limite è `missed`, non un rapporto inventato.
- Pause e `not_evaluated` restano esclusi da numeratore e denominatore.
- La forza (ADR-0019) si estende:
  - `at_least`: `c(t) = min(1, somma dei value nella finestra / targetValue)`.
  - `at_most`: `c(t) = 1` se la somma nella finestra è `<= targetValue`, altrimenti `0`. È binaria per non inventare una scala di «quasi astinenza»; il grafico della forza sarà a gradini, ed è onesto.

### Binding

- I binding restano quelli di ADR-0015.
- Un completamento di Task può alimentare un habit `at_least` con `value = 1` (o il valore configurato nel binding, se in futuro servirà).
- Un habit `at_most` **non accetta binding da completamenti di Task** in v1.1: un task completato non è un lapse. Resta manual-only. Un binding con effetto `consume` è fuori scope.
- Lo stesso Task su più habit resta ammesso; il valore è per habit.

### Migrazione

- Se v1 è già in produzione: ogni `HabitEvidence` esistente riceve `value = 1`; ogni `HabitConfigVersion` riceve `targetType = at_least`, `targetValue = target`, `unit = count`; ogni `Habit` riceve `kind = count`.
- Se v1 non è ancora in produzione, lo schema nasce già con i campi e i default; la migrazione è vuota.
- Nessun dato storico viene riscritto: `target` diventa `targetValue`, il resto resta.

### Fuori scope

- Target con minimo e massimo insieme (range).
- Più unità nello stesso habit.
- Valute, conversioni di unità, metriche derivate da più campi.
- Binding `at_most` con effetto `consume`.
- Unità libere senza display: l'unità è sempre una stringa mostrata.

## Schema concettuale

```text
Habit
  kind: count | quantity

HabitConfigVersion
  targetType: at_least | at_most
  targetValue: decimale
  unit: testo
  granularity, timeZone, effectiveFromPeriod

HabitEvidence
  value: decimale (default 1)
  unique(habitId, activityId, periodKey)

Score(period)
  sum = Σ value(evidenze non rettificate)
  at_least: met se sum >= targetValue
  at_most:  met se sum <= targetValue

Strength(t)  // ADR-0019
  at_least: c = min(1, sum finestra / targetValue)
  at_most:  c = 1 se sum finestra <= targetValue, altrimenti 0
```

## Invarianti

1. Un habit `count` è un `quantity` con `unit = count`, `value = 1` e `at_least`; non ha un modello separato.
2. `value >= 0`; un'evidenza con `value = 0` non viene salvata.
3. Per `at_most` l'evidenza è consumo o lapse; l'assenza è successo.
4. La deduplicazione resta `(habitId, activityId, periodKey)`.
5. Gli aggregati restano binari; `at_most` non ha credito parziale.
6. I binding da Task alimentano solo `at_least` in v1.1.
7. Pause e `not_evaluated` restano neutrali.
8. La migrazione non riscrive la storia: cambia la forma, non i fatti.
9. La forza estende ADR-0019; per `at_most` è binaria.
10. Nessuna parte di questo ADR è implementata in v1.

## Conseguenze

- **ADR-0014:** supersede le clausole «l'obiettivo misura solo un conteggio di evidenze», «durata e metriche con unità libera fuori v1» e «habit negativi o di astensione fuori v1».
- **ADR-0015:** aggiunge `value` a `HabitEvidence` e limita i binding per `at_most`.
- **ADR-0019:** estende la formula della forza a valori e `at_most`.
- **ADR-0013:** il flusso Habits ha un criterio di fatto misurabile anche per quantità e astensione.
- **ADR-0011:** export e backup includono `value`, `unit`, `targetType`.
- **UI:** il check-in `at_most` cambia etichetta e non mostra una spunta; i grafici mostrano consumo e limite.
- **Roadmap:** v1.1, dopo che il modello v1 è stabile.

## Alternative scartate

- **Un tipo `NEGATIVE` separato:** duplica il modello numerico; `at_most` copre l'astensione senza un secondo motore.
- **Check-in invertito per `at_most` («sono stato bravo»):** perde la quantità e rende «2 sigarette» non rappresentabile; il consumo è più espressivo.
- **Unità sull'evidenza:** consente unità miste nello stesso habit e rende la somma ambigua; l'unità è della configurazione.
- **Credito parziale per `at_most` negli aggregati:** inventa una scala di compliance; il periodo ha superato il limite o no.
- **Binding `at_most` da task completati:** un task completato non è un lapse e gonfierebbe il consumo.
- **Metriche libere senza unità:** l'unità serve a mostrare, esportare e capire il numero.
- **Target min e max nello stesso habit:** fuori scope; due habit separati sono più chiari.
