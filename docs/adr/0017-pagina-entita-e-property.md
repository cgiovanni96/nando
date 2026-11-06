# 0017 — Pagina di entità, property ereditate e fatti di capability

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-59 — Knowledge: proprietà, backlink, viste e ricerca
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Emendato da:** ADR-0024 (property locali di entità)

## Contesto

ADR-0001 ha messo `Property` e `PropertyValue` nel kernel, non dentro Knowledge, per poterli condividere con Relationships. ADR-0002 ha reso lo Space il contenitore primario, con `kind` area/project/resource e gerarchia. ADR-0004 ha tenuto lo stato del task sull'Occurrence. ADR-0005 ha vietato al core di dipendere da una capability.

Il ticket chiedeva il modello delle property di Knowledge. La descrizione della UI ha spostato la domanda più in basso: le property non servono solo ai documenti, servono alle **pagine** di Area, Progetto, Task e Risorsa. E ha portato un vincolo di prodotto esplicito: l'interfaccia è progettata a mano, non costruita dall'utente. Non è Notion, e non deve diventarlo per caso.

Il rischio concreto era questo: se ogni entità può inventare le proprie property, le pagine smettono di essere confrontabili, le viste non hanno colonne comuni e il modello diventa un database builder. La decisione evita quel esito senza rinunciare agli attributi aperti.

## Decisione

### Una pagina, tre zone

1. **Campi core** — colonne tipizzate, obbligatorie, con default, non eliminabili: titolo, stato del task, date, Space. Li difende il codice.
2. **Property** — valori aperti, **tutti opzionali**, con definizioni che sono dati e appartengono a uno Space.
3. **Pannelli di capability** — fatti posseduti da un modulo, mostrati in **sola lettura** con un link al modulo: il binding di un task a un habit oggi, il piano di Learning domani.

Le tre zone possono stare nella stessa griglia visiva, ma non sono intercambiabili. In particolare, **lo stato di un task resta un campo core** (ADR-0004): può essere reso graficamente accanto alle property, ma non è una property e non è eliminabile.

### Definizioni come dati

```text
PropertyDefinition
  id, spaceId, key, label, type, format?, options?,
  appliesTo[]        // space:area | space:project | space:resource | task | doc
  deletedAt?

PropertyValue
  id, entityType, entityId, definitionId,
  valueText?, valueNumber?, valueDate?, valueDateEnd?, valueBool?,
  provenance, createdAt, updatedAt
  unique(entityType, entityId, definitionId)
```

- **Tipi v1**: `text`; `number` con format `integer | decimal1 | decimal2 | currency` (EUR di default); `date` con format `date | datetime | range`; `select`; `multi_select`; `checkbox`; `link`.
- **Le definizioni sono dati, non codice**: crearne una è un'azione dell'utente, non una migrazione e non un deploy.
- **`appliesTo`** dichiara i tipi di entità: una definizione per `space:resource` non compare sui task. È questo che evita colonne vuote ovunque.
- **Ereditarietà verso il basso**: una definizione vale per lo Space che la dichiara e per tutti i discendenti. Un progetto può aggiungere le proprie; **nessuno può nascondere quelle ereditate**, altrimenti i task di progetti diversi della stessa Area non sarebbero più confrontabili.
- **Nessuna property obbligatoria.** L'obbligatorietà è dei campi core. Una property mancante è un'informazione, non un errore che blocca la cattura rapida.
- **Valori orfani conservati**: se un'entità si sposta e una definizione non si applica più, il valore resta nel database, sparisce dalla UI e la pagina avvisa. Nessuna cancellazione silenziosa, nessun trasferimento bloccato.
- Eliminare una definizione è una soft delete: i valori restano, nascosti.

**Nota di amendamento (ADR-0024).** Questo modello descrive le definizioni di Space. ADR-0024 aggiunge le **property locali di entità**: definizioni legate a una singola entità, non ereditate, visibili solo nella pagina dell'entità e escluse da viste, ricerca e AI in v1. Per quelle definizioni non valgono l'ereditarietà e la visibilità nelle viste descritte qui.

### I valori, precisazione ad ADR-0011

ADR-0011 descriveva `property_value.value` come `jsonb`. Con sette tipi chiusi e filtri che devono usare indici, il valore diventa **colonne nullable tipizzate** (`valueText`, `valueNumber`, `valueDate`, `valueDateEnd`, `valueBool`) più il tipo nella definizione. Un `range` usa `valueDate` e `valueDateEnd`; una `multi_select` usa `valueText` come array serializzato con indice GIN. Il resto di ADR-0011 — `provenance`, `validFrom`, `validTo`, `supersededBy` — resta, con i campi di lifecycle **non usati in v1**: il lifecycle di Knowledge è "valore corrente sovrascritto". Facts e Memory li useranno con Relationships.

### Le property non sono comandi

- Una capability può **leggere** una property (per esempio un binding che filtra per `frequenza`), mai usarla come scorciatoia per scrivere stato di dominio.
- Scrivere `stato = done` non completa un task: i completamenti passano dal comando idempotente di ADR-0003, con la sua Occurrence e la sua evidenza.
- Questa regola è ciò che impedisce alle property di diventare un secondo percorso di scrittura con due verità.

### Pannelli di capability

- Un fatto di capability **non è una property**: il binding di un habit è un'entità di Habits (ADR-0015), definita per quella singola entità, e non ha senso come definizione di Space.
- La pagina lo mostra in sola lettura. Le azioni restano nel modulo, dove vivono comandi, validazione e idempotenza.
- Il pannello dichiara il modulo proprietario e offre un link alla schermata che lo governa.

### Aree che nascono da una capability

- Non sono un secondo modello di organizzazione: sono **Space + capability attiva + schermata fornita dalla capability**. Uno Space con `kind = area`, `SpaceCapability` attiva e una UI dedicata che la shell mostra quando lo apri.
- Nessun nuovo tipo di entità, nessuna duplicazione di lifecycle o permessi.
- Nota di vocabolario: la capability di apprendimento si chiama **Learning** nel glossario; la sua mappa è separata.

### Cosa vede la pagina di un task

Esempio: task "Prenotare visita", dentro il progetto "Visita odontoiatrica", dentro l'area "Salute".

- **Core**: titolo, stato (`open`), data, Space.
- **Property ereditate**: `frequenza` (definita su Salute, `appliesTo: task`) e `costo` (definita sul progetto, `appliesTo: task`), entrambe vuote. `medico` non compare: è dichiarata per le risorse.
- **Pannello**: binding all'habit "Atti d'amore", sola lettura.
- **Note**: documento di note, se esiste.

Nella lista dei task dell'Area, le colonne sono i campi core più le definizioni applicabili ai task in quel sottoalbero. Questo è il motivo per cui non esiste un view builder: la vista deriva dallo schema, non da una configurazione.

## Schema concettuale

```text
Salute (area)
├── definisce: medico (text, space:resource), frequenza (select, task)
├── Sonno (area)
├── Visita odontoiatrica (progetto)
│   ├── definisce: costo (currency, task)
│   └── task "Prenotare visita"  ──▶ frequenza, costo, pannello Habit, note
└── Protocollo digiuno (risorsa)
    ├── definisce: stato lettura (select, doc)
    └── doc "Come funziona il digiuno"
```

## Invarianti

1. Un campo core non è una property e non è eliminabile.
2. Una definizione appartiene a uno Space e si eredita verso il basso senza poter essere nascosta.
3. Una definizione dichiara a quali tipi di entità si applica.
4. Le property dinamiche sono sempre opzionali; l'obbligatorietà è dei campi core.
5. Un valore orfano non si cancella: si nasconde e si segnala.
6. Le property si leggono, non sono comandi di dominio.
7. I fatti di capability si mostrano in sola lettura e restano proprietà del modulo.
8. Un'area con una capability non è un tipo di entità nuovo.
9. Nessuna vista costruita dall'utente: le schermate sono codice.
10. Creare una property è un'azione utente, non una migrazione.

**Nota:** l'invariante 2 vale per le definizioni di Space; ADR-0024 aggiunge l'eccezione delle property locali di entità.

## Conseguenze

- **ADR-0001:** `PropertyValue` diventa finalmente operativo, e il primo consumatore è la pagina di entità, non Knowledge.
- **ADR-0002:** la gerarchia degli Space acquista un secondo uso: l'ereditarietà delle definizioni.
- **ADR-0004:** lo stato del task resta sull'Occurrence; la pagina lo mostra, non lo trasforma in property.
- **ADR-0005:** i pannelli di capability preservano il confine senza vietare la composizione visiva.
- **ADR-0011:** i valori passano a colonne tipizzate; il lifecycle resta disponibile e non usato in v1.
- **ADR-0016:** il documento diventa un tipo di entità con pagina (titolo, property, editor), e `appliesTo: doc` funziona come per gli altri.
- **NAS-59:** il perimetro Knowledge si riduce di conseguenza: niente view builder, niente property obbligatorie, niente relation.
- **NAS-62:** il mock della shell deve prevedere la pagina di entità a tre zone e la vista d'Area per discendenza.
- **Roadmap:** l'implementazione include la validazione al salvataggio, l'avviso sui valori orfani e il test di ereditarietà delle definizioni.

## Alternative scartate

- **Property definite per entità:** massima libertà, ed è il punto in cui il sistema diventa un clone di Notion: nessuna pagina comparabile, nessuna vista che significhi qualcosa. Parzialmente riaperta da ADR-0024, con scope limitato all'entità e nessuna vista.
- **Definizioni solo sullo Space immediato:** nessuna ereditarietà, quindi i task di due progetti della stessa Area non condividono colonne.
- **Catalogo globale per tipo:** coerente ovunque, ma uno Space non può avere esigenze proprie.
- **Property obbligatorie:** bloccano la cattura rapida per proteggere dati che l'utente sa di non avere ancora.
- **Cancellare i valori al trasferimento:** un trascinamento può distruggere dati senza che nessuno lo veda.
- **Bloccare il trasferimento con valori incompatibili:** trasforma un'operazione banale in un dialogo di tre passi.
- **Fatti di capability come property:** il binding di un habit diventerebbe una definizione di Space e comparirebbe su tutti i task, il rumore che il modello deve evitare.
- **Aree di capability come entità separate:** duplicano Space, lifecycle e permessi per un bisogno che `SpaceCapability` già copre.
- **Editor di property obbligatorie e relazioni con rollup:** un motore di query e una semantica di ciclo, cioè il progetto dentro il progetto.
