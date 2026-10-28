# 0018 — Knowledge v1: wikilink stabili, note e ricerca

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-59 — Knowledge: proprietà, backlink, viste e ricerca
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

ADR-0016 ha fissato il modello del documento: ProseMirror canonico, indice `block` derivato, `blockId` su ogni blocco, immagini solo per `attachmentId`. Ha anche lasciato due questioni aperte e le ha assegnate a questo ticket: **l'identità dei wikilink** e **come nascono le note di Task e Risorsa**. ADR-0008 ha aggiunto il retrieval su `Block` con sensitivity; ADR-0013 ha fissato il flusso "scrivere, linkare, ritrovare". ADR-0017 ha appena stabilito che il documento è un tipo di entità con la sua pagina e le sue property.

Restava il perimetro Knowledge: viste, ricerca, backlink, e cosa sta fuori.

## Decisione

### Documento come entità

- `doc(id, spaceId, title, kind, content jsonb, schemaVersion, sensitivity, version, timestamps)` in `packages/capability-knowledge`.
- `kind`: `page` per una pagina Knowledge, `note` per le note di un'entità.
- Il documento ha una pagina come le altre entità (ADR-0017): titolo e campi core, property con `appliesTo: doc`, editor nel corpo.
- Un documento vive in uno Space; l'Inbox è una vista, non uno Space (ADR-0002).

### Note di Task e Risorsa

- Le note sono **documenti referenziati**: l'entità conserva un `EntityRef` al documento con `kind = note`, creato su richiesta al primo utilizzo.
- Stesso store, stesso indice dei blocchi, stessa ricerca. La UI compone; il core non importa Knowledge (ADR-0005).
- Le note **non compaiono** nelle viste Knowledge per default: sono rumore in un elenco di pagine. Sono però **ricercabili**, perché una nota dimenticata è conoscenza persa.
- Una nota senza entità che la referenzia è orfana e va mostrata come tale, non cancellata in automatico.

### Wikilink: identità stabile

**Questo punto ammenda ADR-0016**, che in v1 risolveva i wikilink per titolo con riscrittura al rename.

- Il nodo `wikilink` porta **`docId` + `label`**: l'identità è l'id, la label è il testo mostrato e viene aggiornata quando il documento viene aperto.
- Un link creato verso un documento inesistente ha `docId: null` e la label digitata: resta "rotto" finché non viene risolto, e la UI propone di creare il documento.
- Un documento rinominato **non rompe nulla**: cambia la label alla prossima apertura, non l'id.
- Il rename non esegue più una passata di riscrittura: non c'è niente da riscrivere.
- L'indice `block.links` contiene i `docId` risolti; i link rotti restano fuori dall'indice e vengono elencati a parte.

### Backlink

- Derivati da `block.links`: una query, non una scansione dei documenti.
- La vista di un documento mostra i documenti che lo linkano, con il blocco che contiene il link come contesto.
- Il rename non produce backlink rotti; l'eliminazione di un documento produce backlink orfani, mostrati come tali.

### Viste: schermate, non query salvate

- **Nessun view builder.** Non esiste la tabella `view`, non esiste un linguaggio di filtro, non esiste una board configurabile a runtime.
- Le viste sono **schermate** definite in codice, progettate a mano: elenco Knowledge di uno Space, pagina d'Area con la discendenza, elenco delle entità di un tipo.
- Le colonne derivano dai campi core più le definizioni applicabili (ADR-0017); ordinamento e filtri sono quelli previsti dalla schermata, non configurabili.
- Una schermata nuova è codice, non configurazione. È il prezzo — basso — per non costruire un database builder.

### Ricerca full-text

- Indice **Postgres `tsvector`** su `doc.title` e `block.text`, dizionario `italian`, indice GIN.
- Un risultato è un **documento**, con il blocco migliore come estratto (`ts_headline`) e il numero di blocchi corrispondenti.
- Ranking: `ts_rank_cd`, con un boost per il match nel titolo. Nessun ranking personalizzato in v1.
- Filtro per Space; nessuna sintassi `campo:valore`. La prosa si cerca, la struttura si filtra con le schermate.
- **Sensitivity**: la ricerca umana vede tutto, `restricted` compreso. Il retrieval AI esclude `restricted` e applica lo Scope prima della query (ADR-0008).
- La ricerca non indicizza le property: un valore si trova filtrando, non cercando.

### Retrieval AI

- L'unità è il **blocco di primo livello** indicizzato: `blockId`, `docId`, testo, sensitivity, posizione.
- Il DTO è minimo: niente documento intero, niente payload nei `Message`; i riferimenti finiscono nei `contextRefs` (ADR-0008).
- **Nessun embedding in v1.** `pgvector` è disponibile nel database, ma la pipeline non esiste finché la ricerca lessicale non fallisce su casi reali.
- Trigger per introdurre gli embedding: query reali che la ricerca lessicale sbaglia per sinonimi o parafrasi, oppure un volume di documenti che rende il full-text insufficiente. Non una data.

### Fuori da Knowledge v1

Graph view, template, daily note, relation e rollup, import markdown, ricerca semantica, embedding. Ognuno con un motivo: costo, dipendenza o assenza di un caso d'uso reale.

## Schema concettuale

```text
doc
  id, spaceId, title, kind (page | note),
  content jsonb, schemaVersion, sensitivity, version, timestamps

block                                   // indice derivato (ADR-0016)
  id, docId, blockId, position, type,
  text, links text[], sensitivity, contentHash

wikilink (nodo del documento)
  docId?     // null = link rotto
  label      // testo mostrato, aggiornato all'apertura

ricerca
  tsvector(doc.title) ─┐
  tsvector(block.text) ─┴─▶ risultato = documento + blocco + snippet
```

## Invarianti

1. L'identità di un wikilink è il `docId`, non il titolo.
2. Un rename non rompe un link e non richiede una riscrittura.
3. Un link senza `docId` è rotto e viene mostrato come tale.
4. Le note sono documenti referenziati, non campi testuali né JSON incorporati.
5. Le note sono escluse dalle viste Knowledge ma incluse nella ricerca.
6. I backlink sono derivati dall'indice, mai memorizzati.
7. Le viste sono codice; nessuna configurazione a runtime.
8. La ricerca umana vede anche `restricted`; il retrieval AI no.
9. Il retrieval AI usa blocchi di primo livello con provenance e sensitivity.
10. Nessun embedding finché non esiste una query reale che lo richiede.
11. Le property non si cercano: si filtrano.

## Conseguenze

- **ADR-0016:** ammendato su due punti — identità dei wikilink (id + label) e note referenziate; il resto del modello del documento resta valido.
- **ADR-0008:** il retrieval ha finalmente la sua unità (blocco indicizzato) e la sua provenance (`docId` + `blockId`).
- **ADR-0017:** Knowledge usa le property con `appliesTo: doc` e la pagina di entità per i documenti.
- **ADR-0005:** le note referenziate evitano al core di importare Knowledge.
- **ADR-0011:** le note entrano nel backup e nell'export come qualsiasi documento.
- **NAS-62:** il mock deve coprire elenco Knowledge, pagina di documento, ricerca e blocco delle note su una pagina d'entità.
- **Roadmap:** l'implementazione include l'indice `tsvector`, il test di coerenza indice↔documento, il caso dei link rotti e il comportamento delle note orfane.

## Alternative scartate

- **Wikilink per titolo con riscrittura:** un rename rompe la conoscenza in silenzio, e la riscrittura è un passo che nessuno garantisce venga eseguito.
- **Alias e redirect per titolo:** una tabella da mantenere che cresce a ogni rename.
- **Note come campo markdown:** niente titoli, tabelle, immagini o backlink dentro le note.
- **Note come JSON incorporato nell'entità:** due store di documenti, fuori da indice, ricerca e backlink.
- **Note dentro le viste Knowledge per default:** ogni task con una nota sporcherebbe l'elenco delle pagine.
- **View builder con query salvate:** è il clone di Notion, e ogni schermata dovrebbe reggere configurazioni arbitrarie.
- **Ricerca con sintassi `campo:valore`:** potente per chi la impara, opaca per chi non la usa ogni giorno.
- **Ricerca che indicizza le property:** mescola prosa e struttura e rende il ranking inspiegabile.
- **Embedding da subito:** un modello, un costo per token e una pipeline di rigenerazione, prima che esista una query che li richieda.
- **Backlink memorizzati:** una seconda verità da tenere allineata a ogni modifica del documento.
