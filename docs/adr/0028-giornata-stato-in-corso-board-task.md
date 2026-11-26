# 0028 — Giornata: stato «in corso», board Task e dashboard a tab

- **Stato:** accettato
- **Data:** 2026-11-22
- **Ticket:** NAS-155 — Prototype del calendario (M2)
- **Emenda:** ADR-0004 (stati dell'occorrenza), ADR-0023 (catalogo widget della dashboard)
- **Prototype:** branch `proto/nas-155-calendario`, `docs/mock/calendar-m2.js`, variante B
- **Emendato da:** ADR-0029 (la board mostra per ogni serie i ritardi, le occorrenze in corso e la prossima)

## Contesto

Il grilling di M2 aveva messo «Prossimi 7 giorni» in dashboard, sotto Oggi, come prevedeva ADR-0023. Il prototype ha mostrato che una lista lunga per giorno occupa la dashboard, che invece deve restare libera per i widget futuri. Abbiamo confrontato tre varianti nel mock: una striscia della settimana dentro Oggi con l'Agenda del calendario, una pagina Task, e le tab nel widget. Per il tempo c'è già il calendario: alla pagina Task serve un altro asse, lo stato di lavoro. ADR-0004 escludeva `in_progress` come rumore per un single-user; con una board diventa l'unico stato intermedio utile.

## Decisione

### Stato «in corso»

- L'occorrenza ha un nuovo stato **`in_progress`**: `open` → `in_progress` → `completed`, con `skipped` e `cancelled` che restano terminali da `open` e da `in_progress`.
- `in_progress` non è terminale e non produce Completion né Evidence. Si torna a `open` senza rettifica: è un cambio di stato di lavoro, non un fatto.
- Per Oggi, ritardi, calendario e drag, un'occorrenza `in_progress` conta come aperta: `overdue` vale per `open` e per `in_progress`.
- `blocked`, priority e tag restano esclusi.

### Nomi

- Lo stato `in_progress` si chiama **«In corso»** nella UI.
- Lo stato temporale derivato `current` di ADR-0004 (`from ≤ now ≤ to`) si chiama **«In svolgimento»** nella UI, per non confondersi con lo stato.

### Pagina Task: board per stato

- Nuova voce **Task** nella navigazione principale (sidebar e bottom nav).
- La pagina è una **board** con tre colonne: **Da fare** (`open`), **In corso** (`in_progress`), **Fatto** (`completed` negli ultimi 7 giorni). Saltati e cancellati non sono colonne.
- Entrano tutte le occorrenze aperte, con o senza Schedule, ordinate per scadenza; quelle senza data vanno in fondo.
- Filtri: Space e scadenza (Tutte, 7, 15 o 30 giorni). Con un orizzonte attivo le occorrenze senza data sono nascoste.
- Spostare una card verso Fatto esegue `complete` (Completion e toast «Annulla»). Uscire da Fatto è una rettifica. Gli altri spostamenti cambiano solo lo stato di lavoro.
- Lo spostamento si fa trascinando la card (desktop) o con le azioni della card (anche su telefono). La board non cambia mai lo Schedule: per il tempo c'è il calendario.

### Dashboard

- Il widget **Oggi** ha due tab: **Oggi** (In ritardo, In svolgimento, Scade oggi; massimo 7 righe e «Mostra tutte (N)») e **Prossimi 7 giorni** (da domani a +6, per giorno).
- «Prossimi 7 giorni» non è più un widget separato sotto Oggi.

## Conseguenze

- **ADR-0004:** gli stati dell'occorrenza diventano `open`, `in_progress`, `completed`, `skipped`, `cancelled`; l'alternativa scartata «`in_progress`» non vale più. `blocked`, priority e tag restano scartati.
- **ADR-0023:** il catalogo widget fonde i punti 1 e 2 in un solo widget a tab; la navigazione principale ha la voce Task.
- **NAS-154:** i comandi `start` e «rimetti da fare» si aggiungono a complete, skip e rettifica.
- **NAS-156:** la dashboard ha le tab invece di due widget.
- **NAS-157:** il popover del calendario ha anche «Inizia».
- **Nuovo ticket:** board Task.

## Alternative scartate

- **Prossimi come lista sotto Oggi** (ADR-0023): troppo spazio in dashboard.
- **Striscia della settimana in Oggi + Agenda 7/15/30:** compatta, ma lascia l'orizzonte lungo solo dentro il calendario.
- **Board per tempo** (In ritardo, Oggi, Domani…): duplica il calendario.
- **Board per Space:** è già la navigazione PARA.
- **Board Da fare · Fatto · Saltato senza stato intermedio:** una lista con l'archivio accanto.
- **Anche `blocked`:** richiede un motivo e un campo in più per un single-user.
