# 0002 — Space, PARA e composizione delle capability

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-43 — Space, PARA e composizione delle capability
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Il handoff conferma due cose: la struttura PARA e la possibilità che uno Space componga più capability. Lascia però aperti proprietà dei dati, schema dei riferimenti, contratto delle capability e comportamento su archivio e migrazione. Serve un modello strutturale che regga anche le estensioni future — Learning e Relationships — senza trasformare lo Space in un modulo.

## Decisione

### Space

- **Space** è il contenitore primario che l'utente naviga. Ha identità, nome, `kind`, `parentId` opzionale e lifecycle.
- **`kind`** vale `area`, `project` o `resource`, ed è **immutabile dalla creazione**. Per correggere un errore si crea lo Space giusto e si spostano le entità.
- **PARA** resta la convenzione di classificazione. **Archive non è un `kind`**: è uno stato del lifecycle, così un progetto archiviato resta un progetto e può essere disarchiviato.
- **Gerarchia** ad albero con grammatica PARA: un'Area può contenere Aree e Progetti; un Progetto può contenere Resource; una Resource è foglia. Tutti possono stare al root. Un `parentId` non può creare cicli.
- Lo Space è **sottile**: non definisce workflow, stati o schemi propri. Il comportamento vive nelle capability.

### Composizione delle capability

- **`SpaceCapability`** è il record esplicito che dichiara una capability attiva in uno Space: `(spaceId, capabilityKey, config, state)`.
- Attivare una capability è un gesto esplicito; l'empty state è parte del prodotto, non un'assenza di dati.
- **Disattivare** trattiene i dati e la storia, rimuove la UI e ferma i contributi attivi. Riattivare ripristina.
- Capability componibili in v1: Tasks, Calendar, Knowledge, Habits. Learning e Relationships saranno estensioni con lo stesso contratto.

### Proprietà dei dati

- Ogni entità ha **un solo Space proprietario**: `spaceId` è nullable per le entità non ancora classificate.
- L'**Inbox** è una vista globale delle entità con `spaceId` nullo. Non è uno Space e non ha lifecycle.
- I riferimenti cross-Space usano **EntityRef** o **Link** e non trasferiscono la proprietà.
- Le entità derivate — HabitEvidence, Completion, Proposal — appartengono allo **Space che le produce**, non a quello dell'entità referenziata. Spostare un Task non trasferisce l'evidenza che lo cita.

### Lifecycle

- Un Project può essere **completato** (`completedAt`) e poi **archiviato** (`archivedAt`): sono due passi distinti. Completare non nasconde; archiviare non dichiara il successo.
- **Archive** è ricorsivo: coinvolge i discendenti, rende le entità read-only, le nasconde dalle viste attive e le esclude dagli aggregati. Storia ed evidenze restano interrogabili. Unarchive ripristina.
- **Deletion** è distinta dall'archivio: nasconde subito e avvia una **purge** definitiva dopo una finestra di grazia, così un errore è annullabile. La cascade delete può slittare oltre v1; il modello la prevede. In v1 la delete immediata resta disponibile per gli Space vuoti.
- **Aggregati**: l'aggregato di un'Area include le entità dei suoi discendenti; quello globale include tutti gli Space attivi. Gli Space archiviati restano fuori. La proprietà unica evita il doppio conteggio.

## Schema concettuale

```text
Space
  id, name, kind, parentId?, completedAt?, archivedAt?, deletedAt?
  kind ∈ {area, project, resource}   // immutabile

SpaceCapability
  spaceId, capabilityKey, config, state
  state ∈ {active, suspended}

Entity (Tasks, Documents, Habits, Events, ...)
  id, spaceId?                        // un solo proprietario

Reference
  EntityRef { type, id }              // cross-Space, senza proprietà
```

## Invarianti

1. `kind` non cambia dopo la creazione.
2. `parentId` non può creare cicli e deve rispettare la grammatica PARA.
3. Archive e deletion cascadono sui discendenti; unarchive ripristina.
4. Un'entità ha al massimo uno Space proprietario.
5. Uno Space archiviato o in deletion non contribuisce agli aggregati attivi.
6. Un'entità derivata appartiene allo Space che la produce, non a quello del referente.
7. Disattivare una capability non cancella i suoi dati.

## Conseguenze

- **NAS-46** può assumere un proprietario unico per entità e `EntityRef` per i riferimenti cross-module.
- **NAS-47** deve prevedere soft delete, purge programmata e la finestra di grazia; la durata resta un parametro.
- **NAS-61 / NAS-63**: lo score di un Habit resta nello Space dell'Habit anche quando il Task che lo alimenta vive altrove.
- **NAS-62**: dashboard globale e viste di Space usano la stessa regola di aggregazione.
- La UI deve mostrare empty state per le capability attive senza dati e impedire modifiche dentro uno Space archiviato.

## Alternative scartate

- **Archive come `kind`**: perde il tipo originale e rende l'archivio un tipo transitorio.
- **Albero libero**: la gerarchia perde significato e i cicli diventano difficili da validare.
- **Capability implicite dai dati**: niente empty state, niente configurazione, disattivazione ambigua.
- **Molti-a-molti**: proprietà ambigua e archivio senza effetto chiaro.
- **Entità globali con Space come vista**: la metafora del contenitore crolla.
- **Space aggregato con campi propri**: diventa un modulo e duplica le Property del Knowledge.
- **Kind modificabile**: rompe la grammatica PARA e richiede di riclassificare i discendenti.
- **Cascade delete immediata**: distrugge storia ed evidenze senza possibilità di recupero.
