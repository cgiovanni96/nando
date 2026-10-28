# 0016 — Knowledge: modello del documento e indice dei blocchi

- **Stato:** accettato
- **Amendato da:** [ADR-0018](0018-knowledge-v1.md) — identità dei wikilink (`docId` + `label` invece del titolo) e note di Task/Risorsa come documenti referenziati
- **Data:** 2026-10-28
- **Ticket:** NAS-54 — Knowledge: editor e modello dei contenuti
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

La scelta dell'editor è già chiusa dalla ricerca NAS-49: **Tiptap 3** come engine, block layer interno, licenza MIT, JSON ProseMirror come escape hatch. Non si riapre. Restava il modello del documento: quali nodi, dove vive l'identità del blocco, cosa succede al paste, come si serializza un allegato, se i backlink sono un indice o un dato.

Il prototipo su `prototype/nas-54` risponde a una parte di queste domande con codice che gira: schema costruito, fixture valide, paste che conserva titoli, grassetto e tabelle e scarta `iframe`/`video`, round-trip JSON identico, allegati risolti da IndexedDB senza byte nel documento. Il resto è ragionamento registrato qui sotto, e va detto chiaramente: **la sessione manuale con pagine web reali non è stata eseguita**. La matrice del paste è quindi provvisoria e va completata durante l'implementazione.

## Decisione

### Il documento è l'albero, non le righe

- **A canonico**: il documento è il JSON ProseMirror salvato in `doc.content` (`jsonb`), con `schemaVersion`. È l'unica verità.
- **La tabella `block` è un indice derivato**, aggiornato nella stessa transazione del salvataggio. Non è modificabile a mano e si può ricostruire da zero.
- **Nessuna sincronizzazione bidirezionale.** B canonico (blocchi come righe, albero assemblato in memoria) è stato scartato: ProseMirror possiede comunque l'editing, quindi ogni salvataggio finirebbe per ricalcolare l'intero set di blocchi — cioè la stessa proiezione, con in più un caricamento da assemblare e un modello più fragile.

### Nodi v1

Blocchi: `paragraph`, `heading` (livelli 1–3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `horizontalRule`, `hardBreak`, `table` + `tableRow` + `tableHeader` + `tableCell`, `image`, `callout`, `toggle`, `wikilink`.

Mark: `bold`, `italic`, `underline`, `strike`, `code`, `link`.

Fuori v1, con motivo:

- **`taskList` / `taskItem`**: Tasks è core (ADR-0005); checkbox dentro Knowledge creerebbero due verità sullo stesso fatto.
- **`mention`**: un `EntityRef` verso `Person` ha senso quando esiste Relationships.
- **`footnote`**: non richiesto dal flusso Knowledge di ADR-0013.
- **Markdown inline**: Tiptap 3 espone specifiche markdown per nodo, ma serve un parser esplicito. In v1 il markdown incollato resta testo.
- **`video`, `iframe`, `embed`**: superficie di sicurezza e peso, senza caso d'uso.

### Identità del blocco

- Ogni nodo di blocco riceve un **`blockId` UUIDv7** alla creazione, a qualunque profondità: serve come ancora per i backlink e per i riferimenti AI.
- **L'indice `block` copre solo i blocchi di primo livello.** Un callout o un toggle sono un blocco solo, con il proprio contenuto dentro: è l'unità giusta per il retrieval (ADR-0008) e mantiene l'indice piatto.
- La **sensitivity** sta sul record indicizzato e può solo alzarsi rispetto al documento (ADR-0008); un `restricted` dentro un callout alza la sensitivity del callout.

```text
doc
  id, spaceId?, title, content jsonb, schemaVersion,
  sensitivity, createdAt, updatedAt, deletedAt?, version

block                                   // derivato, ricostruibile
  id, docId, blockId, position, type,
  text, links text[], sensitivity,
  contentHash, updatedAt
  unique(docId, blockId)
```

- `text` è il testo estratto: serve alla ricerca full-text di NAS-59 senza rileggere il JSON.
- `links` sono i `target` dei wikilink contenuti nel blocco: i backlink diventano una query, non una scansione.
- `contentHash` evita di riscrivere righe invariate a ogni autosave.

### Percorso di scrittura

- Un solo punto di scrittura: `saveDocument(docId, json)` scrive il documento e riconcilia l'indice **nella stessa transazione** (upsert per `blockId`, delete degli scomparsi, update di `position`).
- **Autosave debounced** (1–2 secondi di inattività) più salvataggio esplicito. Nessuna scrittura per tasto.
- `rebuild-block-index` ricostruisce l'indice di un documento o di tutti: è la via di riparazione, e il test di coerenza confronta i due lati.
- L'indice non è mai esportato come verità: il dump di ADR-0011 lo contiene, ma al ripristino è ricostruibile.

### Allegati

- Il nodo `image` conserva **solo** `attachmentId`, `alt`, `width`. Mai byte, mai `data:` URL nel documento.
- I byte stanno su R2 (ADR-0011); un'immagine incollata dal web viene caricata e il nodo viene riscritto con l'`attachmentId`. Se il caricamento fallisce, il nodo non entra: meglio perdere l'immagine che salvare un blob nel JSON.
- Il resto degli allegati (PDF, file) non è v1: solo immagini e solo dentro Knowledge.

### Wikilink e backlink

- Il wikilink è un **nodo atomo** con `target` (il testo digitato), non un mark.
- In v1 la risoluzione è **per titolo**: un documento rinominato rompe i link in silenzio, e la UI li mostra come rotti.
- Il rename offre un passaggio di riscrittura dei `target` nei documenti che lo citano. **Alias e redirect stabili sono rinviati a NAS-59**, insieme alla decisione se serve un `docId` nel nodo.
- I backlink si derivano da `block.links`: nessuna tabella dedicata.
- Un link a un documento inesistente è legittimo e la UI deve proporre di crearlo.

### Properties

- Fuori dal documento: `PropertyValue` nel kernel (ADR-0001), mostrate in un pannello laterale.
- Nessuna property come nodo della prosa: il valore è generico, il comportamento è codice, e la prosa non è una tabella.

### Paste

- Normalizzazione dichiarata: titoli, paragrafi, liste, quote, code, tabelle, immagini, link e mark tipografici sopravvivono; `iframe`, `video`, `style`, `script`, `font` vengono scartati.
- Il markdown incollato resta testo semplice: nessun parser in v1.
- La matrice completa va verificata con pagine reali in implementazione, e ogni scarto inatteso diventa un caso di test.

### Lettura e versioni

- `schemaVersion` viaggia nel documento. In lettura, un nodo sconosciuto viene **scartato con un warning e il documento viene marcato**: mai riscritto in silenzio.
- Nessun versioning del documento in v1: l'undo è quello dell'editor, la storia è il backup.

## Schema concettuale

```text
edit ──▶ ProseMirror doc (jsonb)  ──▶ reconcile ──▶ block index
                 │                                      │
                 │                                      ├─ ricerca full-text (NAS-59)
                 ├─ wikilink nodes ─▶ links text[]  ────┼─ backlink (query)
                 └─ image.attachmentId ─▶ R2            └─ retrieval AI (ADR-0008)
```

## Invarianti

1. Il documento è la verità; l'indice è una proiezione ricostruibile.
2. Una sola scrittura per documento, in una sola transazione, da un solo punto.
3. Ogni nodo di blocco ha un `blockId` stabile.
4. Il documento non contiene byte né `data:` URL.
5. I wikilink sono nodi, non mark, e i backlink sono derivati.
6. La sensitivity di un blocco può solo alzarsi rispetto al documento.
7. Un nodo sconosciuto non viene mai scartato in silenzio.
8. Le properties non vivono nella prosa.
9. Nessun elemento di Knowledge duplica Tasks: niente checkbox, niente scadenze.

## Conseguenze

- **ADR-0008:** il `Block` del retrieval è il blocco di primo livello nell'indice; la sensitivity vive lì.
- **ADR-0011:** l'indice è derivato, quindi il ripristino non dipende da lui; il dump lo contiene e `rebuild-block-index` lo rigenera.
- **ADR-0013:** il flusso Knowledge di v1 è scrivere, linkare, ritrovare — questo modello lo copre.
- **NAS-59:** eredita l'indice, la ricerca su `block.text`, i backlink su `block.links`, e le decisioni rinviate: `docId` stabile nei wikilink, alias e redirect.
- **NAS-62:** un widget può leggere l'indice senza parsare documenti.
- **Roadmap:** l'implementazione include il test di coerenza indice↔documento e la matrice del paste con pagine reali.
- **Prototipo:** `prototype/nas-54` resta l'artefatto primario; non entra in `main`.

## Cosa non è stato validato

Onestà sul metodo: la sessione manuale del prototipo non è stata eseguita. Restano da provare su pagine web reali la matrice del paste, il comportamento di tabelle annidate e immagini `data:`, e la scorciatoia `[[...]]` da tastiera. Nessuno di questi punti cambia la decisione presa — che riguarda dove vive la verità — ma tutti possono cambiare la lista dei nodi o le regole di normalizzazione, e vanno chiusi in implementazione.

## Alternative scartate

- **B canonico (blocchi come righe):** richiede un diff a ogni salvataggio, path annidati per callout, toggle e tabelle, e alla fine ricalcola l'intero set di blocchi — cioè la stessa proiezione, con più fragilità.
- **Sincronizzazione bidirezionale:** due fonti di verità modificabili, con un solo utente e un solo editor. Costo senza beneficio.
- **Solo A, senza indice:** ricerca e backlink richiederebbero di parsare ogni documento; il costo si sposta su ogni lettura invece che su ogni scrittura.
- **Liste di task dentro Knowledge:** duplica Tasks e crea due verità sui completamenti.
- **Properties come nodi della prosa:** confonde campo aperto e campo core, e rende le property non interrogabili.
- **Immagini inline come `data:` URL:** byte nel documento, export enorme, backup che cresce senza controllo.
- **Wikilink come mark:** un mark non ha attributi propri né identità, e i backlink diventerebbero una euristica sul testo.
- **Versioning del documento in v1:** la storia è il backup; l'undo è dell'editor.
