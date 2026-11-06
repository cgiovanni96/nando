# 0024 — Property locali di entità

- **Stato:** accettato
- **Data:** 2026-11-06
- **Ticket:** NAS-62 — Dashboard e shell: navigazione, widget, layout
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0001, ADR-0011, ADR-0017
- **Emenda:** ADR-0017

## Contesto

ADR-0017 ha fissato le property come definizioni di Space, ereditate verso il basso, e ha scartato le «property definite per entità» perché trasformano Nando in un clone di Notion. Il mock di NAS-62 ha introdotto «Aggiungi proprietà» sulla pagina di un task. La decisione è tenerlo, ma con un perimetro stretto: una property definita su una singola entità, non ereditata, non visibile nelle viste di Space, non usata da ricerca o AI in v1.

Questa è un'eccezione controllata al modello di ADR-0017, non una riapertura del property builder. Le definizioni di Space restano l'unico modo per condividere attributi tra entità e per costruire colonne di vista.

## Decisione

### Scope della definizione

`PropertyDefinition` acquisisce uno scope esplicito:

```text
PropertyDefinition
  id
  scopeKind: 'space' | 'entity'
  spaceId?          // obbligatorio se scopeKind = 'space'
  entityType?       // obbligatorio se scopeKind = 'entity'
  entityId?         // obbligatorio se scopeKind = 'entity'
  key, label, type, format?, options?
  appliesTo[]
  provenance, createdAt
  deletedAt?

  check (
    (scopeKind = 'space'
      and spaceId is not null
      and entityType is null
      and entityId is null)
    or
    (scopeKind = 'entity'
      and spaceId is null
      and entityType is not null
      and entityId is not null)
  )

  unique(spaceId, key)
    where scopeKind = 'space' and deletedAt is null
  unique(entityType, entityId, key)
    where scopeKind = 'entity' and deletedAt is null
```

- Per una definizione di Space, `appliesTo` resta quello di ADR-0017.
- Per una definizione locale, `appliesTo` è esattamente `[entityType]`.
- `entityType` usa il token concreto già usato da `appliesTo`: `space:area`, `space:project`, `space:resource`, `task`, `doc`, e in futuro `person`, `habit`, `interaction`. `EntityRef` continua a usare `space`, `task`, `doc`; la conversione avviene nel modulo che possiede l'entità.
- `PropertyValue` non cambia: stessa provenance, stesso `unique(entityType, entityId, definitionId)`.
- Le definizioni esistenti migrano con `scopeKind = 'space'`.

### Chiavi e label

- La `key` di una definizione locale è **generata e opaca**: `local:<uuid>`. Il namespace `local:` è riservato alle definizioni locali: una definizione di Space non può usarlo. La key non è modificabile.
- La `label` è scelta dall'utente e può essere modificata.
- Alla creazione, se la label coincide con una label ereditata applicabile all'entità, la UI avvisa ma non blocca. Le due property restano distinguibili per origine (`da <Space>` / `solo questa entità`).
- Una definizione di Space creata in seguito non fa fallire nulla: la locale e l'ereditata coesistono e la pagina mostra l'origine.

### Tipi e valori

- Tipi locali v1: `text`, `number`, `date`, `checkbox`, `link`.
- Niente `select` o `multi_select` locali: gestire le opzioni sarebbe un property builder.
- `options` è null per le locali. `format` è ammesso solo dove non richiede opzioni (per esempio `number` decimale o valuta, `date` data o datetime).
- `key` e `type` sono immutabili dopo la creazione. La `label` è modificabile.
- Una property locale è sempre opzionale: un valore mancante è assenza, non un errore.
- Scrivere una property locale è una scrittura di `PropertyValue`, non un comando di dominio. Non cambia lo stato core dell'entità.

### Visibilità

- Una property locale compare **solo nella pagina dell'entità**, in un gruppo separato `Solo questa entità`.
- Non compare nelle viste o nelle colonne di Space, nella ricerca, nei read model condivisi o nel retrieval AI in v1.
- Su una pagina di Space, le property locali riguardano lo Space stesso, non i suoi discendenti. Le definizioni per i discendenti restano un'altra cosa e non diventano un property builder.
- Il mock NAS-62 dimostra il pattern sul task; il modello è generico per qualsiasi entità.

### Vita della definizione

- **Spostamento:** la locale segue l'entità; spostarla in un altro Space non la tocca.
- **Soft delete:** cancellare una definizione locale la nasconde e nasconde i valori; i record restano per la storia.
- **Purge:** la purge dell'entità elimina definizioni e valori locali, come previsto da ADR-0011.
- **Duplicazione:** fuori v1. Se arriverà, la copia delle locali sarà una scelta esplicita.
- **Promozione a Space:** fuori v1. Se arriverà, richiede un comando che migra definizioni e valori e gestisce le collisioni.
- **Limite:** massimo 20 definizioni locali attive per entità. È un guardrail contro la deriva da property builder, non un vincolo di dominio.

### Interfaccia

- Nella pagina dell'entità, dopo le property ereditate, un gruppo `Solo questa entità` con le property locali e il controllo `Aggiungi proprietà locale`.
- Il controllo offre solo i cinque tipi v1, non gestisce opzioni, non crea viste e non cambia la struttura della pagina.
- Il mock attuale implementa il pattern sul task. La stessa sezione è riusabile sulle altre entità.
- La copia della UI deve dire «solo questa entità», non «solo questo task», quando il componente è condiviso.

### DTO

- Il read model dell'entità espone un solo array `properties`, con `origin`:
  - `{ kind: 'space', spaceId, spaceName }` per le ereditate;
  - `{ kind: 'entity' }` per le locali.
- L'ordine è: ereditate, poi locali. La UI raggruppa per `origin.kind`.
- Il DTO include `definitionId`, `label`, `type`, `value`, `origin`. La `key` resta interna per le locali; per le definizioni di Space può essere inclusa quando serve a una capability.
- Non si usa la `key` locale come identificatore pubblico stabile: l'identificatore è `definitionId`.

## Schema concettuale

```text
Space Salute
  definisce: frequenza (select, task)        ← definizione di Space, ereditaria
  definisce: medico (text, space:resource)   ← definizione di Space, ereditaria

Task "Comprare fiori"
  ereditate: occasione = anniversario
  locali:    priorità personale = alta       ← solo questa entità
             link regalo = https://…          ← solo questa entità
  capability: Habit "Atti d'amore"            ← fatto del modulo, sola lettura

PropertyDefinition
  scopeKind = entity
  entityType = task
  entityId = <task id>
  key = local:<uuid>
  appliesTo = [task]
```

## Invarianti

1. Una definizione di Space si eredita; una definizione locale no.
2. Una definizione locale è visibile solo nella pagina dell'entità; non entra in viste, ricerca o AI in v1.
3. La `key` locale è opaca e namespaced; il namespace `local:` è riservato alle definizioni locali. La label non crea shadowing: l'origine è sempre visibile.
4. I tipi locali sono fissi; niente opzioni, niente select, niente modifiche di tipo o key.
5. Una property locale è una `PropertyValue`, non un comando di dominio.
6. Cancellare una definizione locale nasconde i valori; la purge dell'entità li elimina.
7. Duplicazione e promozione a Space sono fuori v1.
8. Massimo 20 definizioni locali attive per entità.
9. `entityType` usa il token concreto di `appliesTo`; `EntityRef` resta il riferimento debole di ADR-0003.
10. Ogni definizione e ogni valore locale porta provenance.

## Conseguenze

- **ADR-0017:** viene emendato. L'invariante «una definizione appartiene a uno Space» vale per le definizioni di Space; le locali sono l'eccezione. L'alternativa scartata «property definite per entità» è riaperta in forma limitata.
- **Glossario:** `Property` va aggiornata; entra il termine `Local property`.
- **Brief NAS-62:** il vincolo «nessun pulsante aggiungi proprietà» diventa «nessuna property di Space configurabile; le locali sì, con le regole di questo ADR».
- **Mock NAS-62:** il controllo esistente resta, con copy e regole aggiornate; il pattern è dichiarato generico.
- **Persistenza:** migrazione con `scopeKind`, `entityType`, `entityId`, check e indici; le righe esistenti diventano `space`.
- **ADR-0011:** export e backup includono definizioni e valori locali come qualsiasi altra property.
- **AI:** le locali sono escluse dal retrieval in v1; un'inclusione futura richiede una policy esplicita.
- **API:** il DTO dell'entità espone `properties` con `origin`; non serve un endpoint separato per le locali.
- **NAS-62:** il mock può chiudere con questa eccezione registrata; la vista di Space non diventa un property builder.

## Alternative scartate

- **Definizione inline dentro `PropertyValue`:** evita una tabella, ma perde il tipo condiviso, la validazione e la query indicizzata. La definizione resta un record.
- **Campo JSON sul task:** non è una property; niente tipi, niente validazione, niente query. Sarebbe un contenitore opaco travestito da property.
- **Property locali con select e opzioni:** riapre il property builder e la gestione delle opzioni; fuori v1.
- **Property locali visibili in viste e AI:** le viste dipenderebbero dall'entità e il modello tornerebbe a essere un database builder.
- **Promozione a Space in v1:** richiede migrazione, collisioni e un comando di promozione; rimandata.
- **Nessun limite per entità:** il rischio di deriva è troppo alto per un'app che vuole una struttura fissa.
- **Lasciare ADR-0017 invariato:** la pagina task del mock sarebbe fuori modello; l'eccezione va registrata, non nascosta.

## Questioni aperte

- Il limite di 20 è una costante di prodotto o una preferenza configurabile?
- Quando una definizione di Space arriva con la stessa label di una locale, basta l'origine visibile o serve un avviso più forte?
- La promozione a Space e la duplicazione delle locali sono candidate v2; richiedono un ADR dedicato.
- Le property locali su una pagina di Space meritano una sezione dedicata nella UI, distinta dalle definizioni per i discendenti.
