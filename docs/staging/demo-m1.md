# Demo M1 — cattura e collocazione

Questa checklist chiude M1: verifica i test, ricrea lo staging da un database vuoto, esegue la demo del flusso 1 e avvia la settimana d'uso. La procedura infrastrutturale di base resta in [demo-m0.md](demo-m0.md).

## 1. Gate locale e CI

```bash
pnpm verify
```

Atteso: `typecheck`, `lint`, `db:check`, `deploy:check`, `docs:check`, `test`, `test:integration` e `build` verdi. Sulla PR, i quattro job `static`, `unit`, `integration` e `build` devono essere verdi.

`pnpm db:check` deve riportare `migrazioni allineate allo schema`: nessun drift fra schema Drizzle e journal.

## 2. Staging da un database vuoto

Questa parte è distruttiva: cancella i dati dello staging, che in M1 sono solo di prova. Non tocca la produzione.

1. Trova container e volume dello staging sulla VPS:

   ```bash
   sudo docker ps --format '{{.Names}}\t{{.Image}}' | grep nando-staging
   sudo docker volume ls --filter name=nando_staging_pgdata
   ```

2. Ferma lo staging da Dokploy, poi rimuovi container e volume. Il volume ha un nome fisso nel compose, quindi resta riconoscibile anche se Dokploy usa un nome progetto diverso:

   ```bash
   sudo docker rm -f $(sudo docker ps -aq --filter name=nando-staging)
   sudo docker volume rm nando_staging_pgdata
   ```

3. Deploya il tag immutabile che contiene questa milestone:

   ```bash
   gh workflow run deploy-staging -f image_tag=sha-<full-sha>
   gh run watch
   ```

4. Verifica che `migrate` abbia applicato la catena e seminato owner e Space:

   ```bash
   sudo docker logs $(sudo docker ps -aq --filter name=nando-staging-migrate) 2>&1 | tail -n 20
   ```

   Atteso: `migrations applied, owner and initial Space seeded`.

5. Interroga il database vuoto:

   ```bash
   DB=$(sudo docker ps --format '{{.Names}}' | grep nando-staging | grep db | head -n1)
   sudo docker exec "$DB" psql -U nando -d nando_staging \
     -c 'select id, name, kind from space;' \
     -c 'select id from "user";'
   ```

   Atteso: una sola riga in `space` (`Vita`, `area`) e una sola riga in `user` con l'`OWNER_USER_ID` dello staging.

6. Smoke:

   - `https://<vps>.<tailnet>.ts.net/healthz` → `{"status":"ok"}`
   - `/api/health` → healthy
   - `/api/reference` → Scalar (lo staging ha `DOCS_ENABLED=true`)

## 3. Demo del flusso 1

Apri lo staging dal telefono o dal laptop nel tailnet. Tieni un cronometro per il primo passo.

| # | Azione | Atteso |
| --- | --- | --- |
| 1 | Dashboard → «Cosa devi fare?» → scrivi `Comprare il pane` → «Aggiungi» | Il task compare in Inbox; il gesto dura meno di dieci secondi |
| 2 | Apri il task dall'Inbox | La pagina entità mostra breadcrumb `Inbox`, stato `Aperto`, nessuna scadenza |
| 3 | Nel campo Space scegli `Vita`, poi «Salva», poi ricarica la pagina | Breadcrumb `Vita`; il task resta salvato dopo il reload |
| 4 | Torna in Inbox | Il task non è più in Inbox: ha un solo Space proprietario |
| 5 | Azioni → «Sposta nel cestino» → «Cancella» | Avviso con data di cancellazione e «Ripristinabile fino al» a sette giorni |
| 6 | Apri il Cestino | Il task è elencato con cancellato e scadenza della grazia |
| 7 | «Ripristina» | Toast «Task ripristinato»; il task torna in `Vita` e `restorableUntil` sparisce |

Il rifiuto del ripristino dopo sette giorni è provato dall'integration test `refuses a restore after the grace window`; la demo verifica che la finestra sia visibile e che il ripristino dentro la finestra funzioni.

## 3b. Comandi e scorciatoie

| # | Azione | Atteso |
| --- | --- | --- |
| 1 | `n n` da qualsiasi pagina | Si apre la cattura: modale su desktop, drawer dal basso su telefono |
| 2 | `⌘K` | Si apre «Comandi» con i gruppi Vai a, Azioni, Aspetto |
| 3 | Scrivi `Inbox` e premi Invio | Atterri in Inbox |
| 4 | `n d`, `n i`, `n t` | Dashboard, Inbox, Cestino |
| 5 | `?` | Si apre lo stesso spotlight con le scorciatoie a destra |
| 6 | Su un task, `⌘S` | Salva le modifiche; menu Azioni e spotlight mostrano le stesse voci |
| 7 | Da telefono, icona Cerca in topbar → Cestino | Il Cestino è raggiungibile senza il link temporaneo in Inbox |
| 8 | Apri la cattura, poi `⌘K` | Lo spotlight si apre sopra la modale; chiudilo con `⌘K` o cliccando fuori |

Il leader `n` e `?` non scattano mentre scrivi in un campo o dentro una modale; `⌘K` funziona sempre.

## 4. Settimana d'uso

NAS-151 è in staging: un task dentro uno Space archiviato non è più modificabile.

- [x] Deploy del fix NAS-151 verde su staging.
- [ ] Deploy di NAS-152 verde su staging.
- [ ] Le scorciatoie della sezione 3b funzionano su desktop e telefono.
- [ ] Data di avvio: `____-__-__`.
- [ ] Ogni giorno: cattura almeno un task dalla dashboard o con `n n` e collocalo in `Vita` o in Inbox.
- [ ] Ogni giorno: apri un task dalla pagina entità e verifica che il reload non perda nulla.
- [ ] Almeno una volta: sposta un task tra Space, cancellalo e ripristinalo.
- [ ] Annota attrito, bug e ogni volta che hai aggirato Nando con un altro strumento.

La capability è fatta quando la settimana è completa senza aggirare Nando (ADR-0013). Solo allora la roadmap porta M1 a **Done**.

## Riferimenti

- [demo-m0.md](demo-m0.md) — Dokploy, tailnet, deploy e rollback.
- [ADR-0013](../adr/0013-scope-v1-e-criteri-di-fatto.md) — criteri di fatto della v1.
- [ADR-0021](../adr/0021-strategia-test-ci-ambienti.md) — test, CI e ambienti.
