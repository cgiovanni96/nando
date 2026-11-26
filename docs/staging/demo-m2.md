# Demo M2 — Giornata

Questa checklist chiude M2. Verifica i test, deploya su staging ed esegue la demo del flusso 2: dashboard con ciò che è dovuto oggi, calendario della settimana, completare o saltare un'occorrenza. Le procedure infrastrutturali restano in [demo-m0.md](demo-m0.md) e [demo-m1.md](demo-m1.md).

## 1. Gate locale e CI

```bash
pnpm verify
```

Atteso: `typecheck`, `lint`, `db:check`, `deploy:check`, `docs:check`, `test`, `test:integration` e `build` verdi. Su `main`, i quattro job `static`, `unit`, `integration` e `build` sono verdi per il commit di NAS-159 (`bcf0e4d`).

## 2. Deploy su staging

1. Deploya il tag immutabile che contiene NAS-159:

   ```bash
   gh workflow run deploy-staging -f image_tag=sha-<full-sha>
   gh run watch
   ```

2. Verifica che `migrate` abbia applicato le migrazioni di M2 (Schedule, Completion, Rectification, stato `in_progress`):

   ```bash
   sudo docker logs $(sudo docker ps -aq --filter name=nando-staging-migrate) 2>&1 | tail -n 20
   ```

3. Smoke: `/healthz` → `{"status":"ok"}`, `/api/system/info` → 200, `/api/reference` mostra le route `agenda` e board.

M2 cambia lo schema: dopo il deploy prova il rollback al tag precedente, come chiede il criterio 4 della roadmap, e poi rideploya il tag di M2.

## 3. Demo del flusso 2

Apri lo staging dal telefono e dal laptop nel tailnet. Prima della demo crea quattro task: uno scaduto ieri, uno che scade oggi alle 18:00, uno con intervallo che copre l'ora corrente e uno fra tre giorni.

| # | Azione | Atteso |
| --- | --- | --- |
| 1 | Dashboard, tab «Oggi» | Gruppi «In ritardo», «In svolgimento» e «Scade oggi» con i tre task giusti; quello fra tre giorni non c'è |
| 2 | Tab «Prossimi 7 giorni» | Il task fra tre giorni compare sotto il suo giorno; oggi non è incluso |
| 3 | In «Oggi», completa il task che scade oggi | Toast «Task completato.» con «Annulla»; la riga sparisce |
| 4 | Sul task in ritardo, «Salta» | Toast «Task saltato.»; il task non è più in ritardo |
| 5 | Apri il task completato e porta lo stato a «Aperto» | Toast «Task riaperto.»; lo «Storico» mostra «Completato» e poi «Riaperto», nessuna riga persa |
| 6 | Calendario, vista «Settimana» | I task compaiono nel giorno e nell'ora della loro timezone; l'intervallo è un blocco unico |
| 7 | Desktop: trascina un task su un altro giorno, poi allunga un blocco | Lo Schedule cambia; dopo il reload resta spostato |
| 8 | «Mostra senza data», trascina un task sul calendario | Il task riceve uno Schedule e sparisce dal pannello |
| 9 | Popover di un'occorrenza → «Inizia» | Lo stato diventa «In corso»; in «Oggi» la riga mostra «In corso» |
| 10 | Pagina «Task», sposta una card da «Da fare» a «Fatto» | Completion con toast «Annulla»; filtri Space e «Scadenza» nascondono i task senza data con un orizzonte attivo |
| 11 | Da telefono, ripeti 1, 3 e 10 con le azioni della card | Stesso esito senza drag |

Overdue derivato, range, timezone e DST sono provati dai test unit di `schedule` e dagli integration test di TaskOccurrence e Completion: la demo verifica che le viste li mostrino.

## 4. Chiusura

- [x] NAS-153, NAS-154, NAS-155, NAS-156, NAS-157, NAS-158 e NAS-159 su `main`.
- [ ] Deploy del tag di NAS-159 verde su staging; rollback provato.
- [ ] Sezione 3 completata su desktop e telefono.

Con queste voci spuntate la roadmap porta M2 a **Done** e M3 può partire. L'attrito trovato durante la demo diventa un ticket, non un blocco (ADR-0027).

## Riferimenti

- [demo-m1.md](demo-m1.md) — staging da un database vuoto e flusso 1.
- [ADR-0004](../adr/0004-tasks-modello-ricorrenze-completamento.md) — Task, occorrenze, completamento.
- [ADR-0028](../adr/0028-giornata-stato-in-corso-board-task.md) — stato «In corso», board Task e dashboard a tab.
- [ADR-0027](../adr/0027-settimana-uso-solo-a-fine-v1.md) — settimana d'uso solo a fine v1.
