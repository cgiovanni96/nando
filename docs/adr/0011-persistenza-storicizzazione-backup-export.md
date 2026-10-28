# 0011 — Persistenza, storicizzazione, backup ed export

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-47 — Persistenza, storicizzazione, backup ed export
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Gli ADR precedenti hanno fissato i pezzi, non la postura che li tiene insieme. L'ADR-0003 ha imposto outbox e idempotenza per comando, rettifiche append-only, `EntityRef` senza FK cross-module e tombstone per i riferimenti. L'ADR-0008 ha escluso un audit log globale e fissato 90 giorni per le conversazioni; l'ADR-0006 30 giorni per le notifiche; l'ADR-0002 ha lasciato la finestra di grazia della deletion a un parametro; l'ADR-0004 materializza le Occurrences 30 giorni avanti. L'ADR-0010 ha deciso che lo schema vive nel pacchetto che possiede le tabelle e che il journal Drizzle è unico.

Restava la domanda del ticket: **come si registra il cambiamento?** Un single-user con un obiettivo di vent'anni ha bisogno di distinguere due cose che sembrano la stessa: i **fatti** che non devono mai riscriversi (un'evidenza, un completamento, una rettifica, una proposta applicata) e lo **stato corrente** delle entità, che cambia e non ha bisogno di archeologia. Trattare tutto come storia costa tre volte: schema, codice e rumore che nessuno legge. Trattare nulla come storia rende impossibile spiegare uno score.

## Decisione

### Postura

- **Stato corrente nelle tabelle**, CRUD normale, `updatedAt` su ogni riga.
- **Append-only solo dove il dominio lo esige:** `Evidence`, `Completion`, `Rectification`, `Outbox`, esiti di idempotenza, `Proposal` ed effetti applicati, `Provenance` degli immutabili.
- **Nessun audit log globale**, nessuna history table per entità, nessun event sourcing. Un titolo modificato non ha storia; un'evidenza rettificata sì.
- **Ricostruibili:** i fatti qui sopra, i tombstone, i batch di import e i `Signal` che li hanno prodotti.
- **Non ricostruibile:** il valore passato dei campi ordinari di un'entità.
- Niente read model dedicati in v1: le viste leggono lo stato corrente. I read model alimentati da eventi arrivano con l'ADR-0062 se e quando serviranno.

### Convenzioni di schema

- **Chiavi UUIDv7 generate dall'applicazione**, non dal database: ordinabili per tempo, leggibili nei log, nessuna collisione in merge fra record.
- **`timestamptz` in UTC ovunque.** La timezone è attributo di dominio (`Schedule`, preferenze), non di memorizzazione.
- Ogni tabella porta `createdAt` e `updatedAt`; le tabelle cancellabili portano `deletedAt` nullable.
- **`version` intero** su ogni aggregate modificabile: controllo di concorrenza ottimistica, `UPDATE ... WHERE id = $1 AND version = $2`.
- **Stati come `text` + `CHECK`**, mai `ENUM` Postgres: aggiungere un valore a un enum è una migrazione che blocca, un check si sostituisce.
- **Unicità come indici parziali** che escludono le righe cancellate: `UNIQUE (space_id, name) WHERE deleted_at IS NULL`.
- **FK vere dentro il modulo, `EntityRef` fra moduli.** Nessuna FK cross-package, come ADR-0003.
- Il database **non è cifrato a riposo**: la cifratura sta nei backup e negli export. Il disco della VPS è considerato fidato.

### Proprietà e provenienza

- **`Provenance` è una colonna `jsonb` sull'entità**: `{source, actor, method, confidence, at}` più un `sourceId` nullable verso il registro delle Source. Nessuna FK polimorfica, nessun join su ogni lettura, indice GIN solo dove si interroga davvero.
- **`PropertyValue` è una tabella unica nel kernel**: `property_value(id, entityType, entityId, propertyId, value jsonb, provenance, validFrom, validTo?, supersededBy?)`, con indici su `(entityType, entityId)` e su `propertyId`.
- La **lifecycle policy** che dà comportamento a una coppia (tipo di entità, Property) resta codice della capability, come ADR-0001: il valore è generico, il significato no.

### Deletion, purge e tombstone

- La deletion scrive `deletedAt`: l'entità sparisce subito da viste e aggregati, la storia resta interrogabile.
- **Finestra di grazia: 7 giorni.** La delete immediata resta disponibile per gli Space vuoti (ADR-0002).
- **Purge in una transazione per sottoalbero**: prima i figli, poi il padre. Gli eventi outbox ancora pendenti per quegli aggregate passano a `cancelled`; evidenze e completamenti in cascata vengono eliminati, unica eccezione ammessa da ADR-0003. Il backup precedente conserva la versione pre-purge.
- **Tombstone permanente**: `tombstone(type, id, deletedAt)`. Tiene risolvibili gli `EntityRef` senza esporre contenuto, e sopravvive alla purge dello Space. Rimuoverlo è manutenzione manuale, non un effetto collaterale.
- Un tombstone non è leggibile dall'AI: resta escluso dal retrieval come in ADR-0008.

### Retention

Finestre in codice, applicate da un job notturno. Nessuna UI di configurazione in v1.

| Dato | Finestra |
| --- | --- |
| Notification | 30 giorni (ADR-0006) |
| Conversation, Message | 90 giorni (ADR-0008) |
| Esiti di idempotenza | 30 giorni |
| Outbox pubblicata | 7 giorni |
| Dead-letter | 90 giorni |
| Archivio job pg-boss | 30 giorni |
| Log applicativi | 14 giorni |

Le `Proposal` applicate e i fatti (Evidence, Completion, Rectification) non scadono: sono dominio, non telemetria.

### Materializzazione delle TaskOccurrence

- **Ibrida**: alla scrittura del Task si materializzano le occorrenze dentro la finestra; un job giornaliero la estende a 30 giorni avanti (ADR-0004).
- La modifica di una regola di ricorrenza rigenera **solo le occorrenze future ancora aperte**. `completed`, `skipped` e `cancelled` non si toccano mai: sono fatti, non proiezioni.
- La cancellazione di una serie chiude le occorrenze future e cancella le richieste di notifica pendenti (ADR-0006).

### Backup

- **Invariato rispetto a `docs/vps/05-operations.md`**: `pg_dump -Fc` giornaliero, restic su R2, **RPO 24 ore**, **RTO 2–4 ore**, 30 giornalieri / 12 settimanali / 12 mensili, restore test mensile, DR drill trimestrale.
- **PITR non adottato**: WAL archiving è la via di upgrade documentata, da attivare se perdere un giorno di dati diventa inaccettabile.
- **Allegati**: il dump copre il database e restic copre `/srv/nando`, ma gli oggetti vivono su R2 e nessuno dei due li tocca. Si attiva il **versioning degli oggetti** su R2 e si considera l'export mensile la copia fuori dal bucket.
- **La verifica fa parte del backup**: un dump mai ripristinato non è un backup. Il restore test mensile resta obbligatorio e il suo esito va in `maintenance-log.md`.

### Export

- **Formato:** un archivio cifrato con `age` verso una chiave pubblica; la chiave privata sta nel password manager, mai sulla VPS.
- **Contenuto:** `database.dump` (`pg_dump -Fc`, che contiene già il DDL), `schema.sql` **derivato dal dump** con `pg_restore --schema-only`, `MANIFEST.json`, allegati presi da R2, `README.md` con la mappa dei campi.
- **`schema.sql` si deriva dal dump, non dal database**: i due file non possono divergere anche se una migrazione gira nel mezzo.
- **`MANIFEST.json`**: `schemaVersion`, commit SHA, tag immagine, versione del journal Drizzle, conteggi per tabella, `sha256` di ogni parte, data.
- **Cadenze:** on demand (`pnpm export` e un comando nelle impostazioni) più un **export automatico mensile** accanto al restore test. Mai durante un deploy.
- **Destinazione:** bucket R2 `nando-exports`, privato, 12 archivi mensili.
- Include gli Space archiviati, esclude le righe cancellate, include i tombstone.
- **Non è un formato di import**: il ripristino resta il backup. Un estratto leggibile per entità non esiste in v1, e non è un'omissione: è una decisione rinviata.

### Procedura di ripristino

1. Ricreare il container Postgres dell'immagine `pgvector/pgvector:pg17` e verificare le estensioni (`vector`, `pg_stat_statements`).
2. `pg_restore -d <db> --clean --if-exists database.dump` su un database vuoto.
3. Ripristinare `/srv/nando` da restic: compose, segreti, configurazione cloudflared e Dokploy.
4. Impostare `IMAGE_TAG` al tag registrato nel manifest e applicare le migrazioni solo se il journal è indietro.
5. Verificare gli allegati: il versioning di R2 li conserva; se mancano, prenderli dall'archivio di export.
6. Confrontare i conteggi per tabella con il manifest, poi `/api/health` e la lettura di alcune entità reali.
7. Annotare esito e durata in `maintenance-log.md`: il target RTO è 2–4 ore e va misurato, non sperato.

## Schema concettuale

```text
packages/kernel
  property_value(id, entityType, entityId, propertyId, value, provenance, validFrom, validTo?, supersededBy?)
  link(id, fromRef, toRef, kind, activityId?, provenance)
  rectification(id, targetRef, action, reason, provenance, createdAt)
  tombstone(type, id, deletedAt)

packages/core
  space, task, task_occurrence, completion, notification, scheduled_notification,
  digest_run, person        // tutti con version, timestamps, deletedAt dove cancellabili

packages/platform
  outbox(eventId, type, version, aggregateType, aggregateId, payload, status, attempts, publishedAt)
  idempotency(actorId, commandName, key, result, createdAt, expiresAt)
  pg_boss.*                 // schema pg-boss

packages/capability-habits
  habit, habit_source_binding, habit_evidence(habitId, activityId, period, occurredAt, provenance)
  unique(habitId, activityId, period)
```

## Invarianti

1. Lo stato corrente è CRUD; la storia esiste solo per i fatti dichiarati.
2. Un fatto non si modifica: si rettifica con una riga append-only.
3. `updatedAt` cambia a ogni scrittura; `version` cambia solo con un `UPDATE` riuscito.
4. Le unicità ignorano le righe cancellate.
5. La purge è l'unica cancellazione di fatti e avviene solo dopo la finestra di grazia.
6. Il tombstone non contiene contenuto e non è leggibile dall'AI.
7. Ogni retention ha una finestra esplicita; nessun dato personale vive per sempre per inerzia.
8. I fatti di dominio non scadono; solo telemetria, code e conversazioni hanno una scadenza.
9. Una modifica di ricorrenza non riscrive un'occorrenza chiusa.
10. Un backup non è valido finché un restore non è passato.
11. L'export è cifrato e attribuibile: senza manifest non è verificabile.
12. L'export non è un import: ripristinare significa tornare a Nando, non cambiare applicazione.

## Conseguenze

- **ADR-0002:** la finestra di grazia è 7 giorni, non un parametro libero.
- **ADR-0003:** outbox e idempotenza hanno retention e semantica di purge; il tombstone diventa una tabella reale.
- **ADR-0004:** materializzazione alla scrittura più job giornaliero.
- **ADR-0006 / ADR-0008:** le finestre di 30 e 90 giorni restano, ora con un meccanismo che le applica.
- **ADR-0009:** backup invariato; si aggiunge il versioning R2 per gli allegati.
- **ADR-0010:** lo schema è distribuito per pacchetto, con il journal unico in `packages/platform`.
- **NAS-53:** la roadmap include i job di retention, purge, materializzazione ed export.
- **Operazioni:** una chiave `age` da custodire fuori dalla VPS; un bucket `nando-exports` da creare; il restore test mensile va esteso alla verifica di un archivio di export.
- **Costo accettato:** nessun estratto leggibile per entità finché non lo chiederà un caso d'uso reale.

## Alternative scartate

- **History table per entità:** una tabella per tabella, trigger o codice duplicato, e rumore che nessuno legge in v1.
- **Event sourcing:** ricostruibilità totale al prezzo di versioning degli eventi, replay, proiezioni e migrazioni dei payload.
- **Audit log generico:** duplica il dato e non è interrogabile senza ricostruire il significato; ADR-0008 lo aveva già escluso.
- **Nessuna purga automatica:** la deletion resterebbe una promessa falsa.
- **Purga per riga:** riferimenti a metà e Space parzialmente presenti durante il job.
- **Tombstone cancellato con la purge:** rompe la risolvibilità storica degli `EntityRef`.
- **Enum Postgres:** ogni nuovo valore è una migrazione bloccante.
- **UUIDv4 o bigint:** nessun ordinamento temporale, oppure ID indovinabili e remapping nei merge.
- **Provenance in tabella polimorfica:** un join su ogni lettura e un vincolo che il database non verifica.
- **PropertyValue per capability:** tre copie dello stesso schema che divergono.
- **Solo job giornaliero per le occorrenze:** un task creato oggi non compare nel calendario fino a notte.
- **Solo materializzazione alla creazione:** un RRULE senza fine genera righe per sempre.
- **PITR da subito:** un altro consumatore di spazio e una procedura di restore molto più delicata, per un single-user che accetta un giorno di perdita.
- **Export in chiaro:** un solo file con tutta la vita personale, leggibile da chiunque lo trovi.
- **Export come formato di import:** trasforma un contratto di uscita in un vincolo permanente di compatibilità.
