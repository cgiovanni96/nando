# Brief per Open Design — mock di riferimento di Nando (NAS-62)

**Cosa chiediamo:** il design delle schermate principali di Nando, un personal OS single-user, in alta fedeltà e con dati finti realistici. Questo documento è l'unico input necessario: contiene contesto, regole di prodotto, inventario delle schermate, dati di esempio, stati da coprire e criteri di accettazione.

**Lingua della UI:** italiano. Copy in sentence case, senza emoji, senza punti esclamativi.

> **Aggiornamento 2026-11-06:** ADR-0023 e ADR-0024 ratificano la griglia giornaliera delle evidenze con score per periodo, le property locali di entità e la ricerca solo documenti. Le sezioni 3.1, 3.7, 7.2, 7.4, 7.7 e 7.8 sono aggiornate di conseguenza.

---

## 1. Cos'è Nando, in dieci righe

Nando è un'applicazione web **personale, per un solo utente**, che unisce organizzazione per aree e progetti, task, calendario interno, abitudini, documenti e un'AI supervisionata. L'utente è anche lo sviluppatore: l'interfaccia è progettata a mano, non costruita dall'utente dentro l'app.

Non è Notion e non deve sembrarlo. Non ci sono database creati dall'utente, costruttori di viste, colonne configurabili, template o pagine annidate liberamente. La struttura è fissa e il design la rende ovvia.

**Stack visivo previsto:** React + Mantine, con un tema personalizzato in direzione moderna e sobria (riferimento: la pulizia di shadcn/ui, non la sua palette). Il design che produci deve essere realizzabile con componenti Mantine standard più CSS: niente librerie visive esotiche.

---

## 2. Obiettivo del mock e cosa non è

**Obiettivo:** fissare la struttura di otto schermate in modo che l'implementazione non debba reinventare gerarchia, densità e navigazione. Il mock è un riferimento, non un prototipo interattivo completo.

**Non è:** un prodotto cliccabile end-to-end, un esercizio di illustrazione, un'esplorazione di brand. Non servono micro-animazioni, illustrazioni custom o stati di hover spettacolari.

---

## 3. Regole di prodotto da rispettare (vincoli duri)

1. **Le property di Space non si configurano dall'interfaccia.** Nessun pulsante per aggiungere una property di Space, nessun "aggiungi colonna", nessun menu per cambiarne il tipo: compaiono perché esistono nello Space. Le **property locali di un'entità** sono l'unica eccezione: si aggiungono dalla pagina dell'entità, con tipi fissi (testo, numero, data, checkbox, link), non si ereditano e non entrano nelle viste (ADR-0024).
2. **Nessun costruttore di viste.** Gli elenchi hanno colonne e filtri già decisi. Niente pannelli "filtra", "raggruppa", "scegli colonne".
3. **Nessun drag-and-drop strutturale.** Non si trascinano pagine dentro pagine, non si riordinano sezioni, non si annidano blocchi liberamente.
4. **I campi core non sono eliminabili.** Nella pagina di un task, lo stato è un campo obbligatorio: può stare visivamente tra le property, ma non ha una "x" per rimuoverlo.
5. **I fatti di capability sono in sola lettura.** Il binding di un habit su un task si vede, non si modifica da lì: c'è un link al modulo Habit.
6. **Le property dinamiche sono opzionali.** Un valore mancante si mostra come assenza, non come errore che blocca.
7. **Le abitudini hanno uno score per periodo; la griglia mostra le evidenze.** Lo score resta binario per periodo (giorno/settimana/mese/anno) e non diventa un punteggio giornaliero. La vista Habit può mostrare una griglia giornaliera delle evidenze come vista primaria; ogni riga mostra anche progresso e stato del periodo. Il grafico di forza resta campionato a fine periodo (ADR-0019).
8. **La ricerca è una sola.** Nessuna sintassi `campo:valore`, nessun filtro avanzato nell'overlay.

---

## 4. Direzione visiva

- **Tono:** sobrio, denso ma respirabile, da strumento di lavoro quotidiano. Niente dashboard "marketing" con card enormi e gradienti.
- **Tema:** light come default, dark come pari dignità. Specifica i token per entrambi.
- **Tipografia:** una sola famiglia sans (Inter o system UI), scala 12/13/14/16/20/28, peso 400/500/600. I numeri in tabular figures dove sono allineati in colonna. Eccezione dichiarata: il monogramma del marchio (quadrato 28 px con la "N") usa un serif, `Georgia` con fallback, tokenizzato in `theme.other.brandFontFamily` (ADR-0023).
- **Spaziatura:** base 4 px, passi 4/8/12/16/24/32. Raggio 6–8 px. Bordi 1 px, non ombre pesanti.
- **Colore:** neutro dominante, un solo accento per azioni e stato attivo. Il colore non deve mai essere l'unico portatore di significato: abitini, stati e badge hanno sempre etichetta testuale.
- **Icone:** set coerente, 16/20 px, tratto sottile. Niente icone colorate.
- **Densità:** elenchi con righe da 40–44 px; niente righe da 72 px con avatar grandi.

---

## 5. Mappa delle schermate

| # | Schermata | File suggerito | Scopo |
| --- | --- | --- | --- |
| 1 | Shell e navigazione | `shell` | contenitore persistente di tutte le schermate |
| 2 | Dashboard | `dashboard` | cosa conta oggi, in un colpo d'occhio |
| 3 | Pagina d'Area | `area` | una Area con la sua discendenza |
| 4 | Pagina di entità (task) | `entity-task` | la pagina canonica: campi core, property, capability, note |
| 5 | Elenco Knowledge | `knowledge-list` | i documenti di uno Space |
| 6 | Pagina documento | `document` | lettura e scrittura di un documento |
| 7 | Ricerca | `search` | overlay tastiera-first |
| 8 | Vista Habit | `habit-view` | abitudini per periodo |

Dimensioni richieste per ogni schermata: **desktop 1440**, **tablet 900**, **mobile 390**. Se un layout a 900 non ha senso, spiega perché e proponi il comportamento alternativo.

---

## 6. Dati finti — inventario unico

Usa **esattamente** questi dati in tutte le schermate, così il mock è coerente e si può giudicare la densità.

### Aree e Space

```text
Salute (area)
├── Sonno (sotto-area)
├── Visita odontoiatrica (progetto)
└── Protocollo digiuno (risorsa)

Lavoro (area)
├── Nando (progetto)
└── Cliente Studio X (progetto)

Relazioni (area)
├── Anniversari (progetto)
└── Idee regalo (risorsa)

Formazione (area)
└── Tedesco B1 (progetto)

Inbox (vista, non Area)
```

### Property (definizioni)

| Dichiarata in | Nome | Tipo | Si applica a |
| --- | --- | --- | --- |
| Salute | `frequenza` | select: giornaliera / settimanale / mensile | task |
| Salute | `medico` | testo | risorsa |
| Salute → Visita odontoiatrica | `costo` | numero, valuta EUR | task |
| Salute → Protocollo digiuno | `stato lettura` | select: da leggere / in corso / letto | documento |
| Salute → Protocollo digiuno | `fonte` | link | documento |
| Lavoro | `cliente` | testo | progetto, task |
| Lavoro → Nando | `fase` | select: design / build / rilascio | progetto |
| Lavoro → Nando | `stima` | numero, un decimale | task |
| Relazioni | `occasione` | select: compleanno / anniversario / altro | task |

### Task

```text
Prenotare visita            Visita odontoiatrica   open     scadenza 12/11   costo: —
Comprare fiori              Anniversari            open     scadenza 28/10   occasione: anniversario
Scrivere ADR-0019           Nando                  open     scadenza 30/10   stima: 2,5
Rivedere il modello property Nando                 completed 29/10          stima: 1,0
Chiamare Studio X           Cliente Studio X       open     scadenza 31/10   cliente: Studio X
Leggere capitolo 3          Tedesco B1             open     scadenza 02/11
Fare la spesa               Inbox                  open     scadenza 29/10
```

Il task **"Comprare fiori"** ha anche un pannello di capability: `Habit: Atti d'amore`, e un documento di note con due righe.

### Documenti

```text
Come funziona il digiuno intermittente   Protocollo digiuno   stato lettura: letto   fonte: link
Note su Nando                            Nando                —                      —
Idee regalo 2026                         Idee regalo          —                      —
Tedesco: risorse                         Tedesco B1           —                      —
Nota di "Comprare fiori"                 Anniversari          kind: note             —
```

Nel documento **"Come funziona il digiuno intermittente"** c'è un wikilink a "Protocollo digiuno" e uno **rotto** verso "Sonno profondo".

### Habit

```text
Atti d'amore      3 / mese       2 su 3 nel mese corrente    streak 4 mesi
Meditare          1 / giorno      24 su 31 giorni             streak 6 giorni
Palestra          3 / settimana  2 su 3 questa settimana     streak 2 settimane
Leggere           20 / mese       11 su 20                    streak 0
Sonno 7h          1 / giorno      in pausa dal 15/10          streak congelata
```

### Valori orfani da mostrare

Il task **"Chiamare Studio X"** è stato spostato da `Salute` a `Lavoro`: ha un valore per `frequenza` che non si applica più. La sua pagina mostra un avviso discreto: *"1 valore non visibile in questo Space"*.

---

## 7. Schermata per schermata

Per ognuna: obiettivo, struttura, contenuto, stati, azioni, criteri di accettazione.

### 7.1 Shell e navigazione

**Obiettivo:** far sentire Nando un sistema unico, non una raccolta di pagine.

**Struttura (desktop):**

- **Sidebar sinistra, 248 px**, persistente: logo/wordmark in alto, poi:
  - **Cattura rapida** (azione primaria, in alto);
  - **Dashboard**;
  - **Aree** — elenco delle quattro Aree con la loro icona e, in seconda riga, i progetti in numero (`3 progetti`);
  - **Habit**;
  - **Knowledge**;
  - in basso: **Ricerca** con scorciatoia `⌘K` e il nome utente.
- **Topbar, 56 px:** breadcrumb contestuale (`Relazioni / Anniversari`), poi a destra: ricerca compatta, tema, "nuovo".
- **Contenuto:** max-width 1200 px per le pagine di lettura, 1440 pieno per elenchi e dashboard.

**Stati:** sidebar collassata a rail di 64 px; Area attiva evidenziata; progetto attivo evidenziato dentro l'Area.

**Accettazione:** in ogni schermata si capisce in quale Area si è e si torna alla dashboard con un click. La sidebar non deve mai contenere più di 4 Aree senza raggruppamento, e in quel caso mostra "Tutte le aree".

---

### 7.2 Dashboard

**Obiettivo:** rispondere in tre secondi a *cosa devo fare oggi* e *come sto andando*.

**Struttura:** due colonne, 2/3 e 1/3.

**Colonna principale:**

1. **Oggi** — elenco dei task con scadenza oggi o in ritardo. Riga: checkbox, titolo, Area/progetto, orario o "tutto il giorno", badge `in ritardo` se applicabile. Massimo 7 righe, poi "Vedi tutti".
2. **Prossimi 7 giorni** — raggruppato per giorno, righe compatte.
3. **Note recenti** — 3 documenti con titolo, Space e tempo relativo.

**Colonna laterale:**

1. **Habit** — card con l'elenco degli habit attivi. Ogni riga: nome, periodo corrente (`2 su 3`), una barra o indicatore di progresso, pulsante di check-in. La pausa è uno stato visibile, non un'assenza. La riga può mostrare gli ultimi 7 giorni come evidenze, ma il progresso e lo stato restano quelli del periodo: nessun habit settimanale o mensile viene valutato come una sequenza di giorni.
2. **Aree** — elenco compatto con nome, numero di progetti e numero di task aperti.
3. **Inbox** — conteggio delle entità senza Space.

**Stati da disegnare:** giorno senza task ("Niente per oggi" con spazio per la cattura); habit tutti completati; habit in pausa; dashboard al primo avvio senza dati.

**Accettazione:** la gerarchia deve essere chiara senza colore: oggi > habit > prossimi > note. Le card non devono avere la stessa altezza per forza.

---

### 7.3 Pagina d'Area

**Obiettivo:** mostrare cosa contiene un'Area senza diventare un albero infinito.

**Struttura:**

- **Header:** nome Area, tipo (`Area`), property dell'Area (es. `cliente` per un progetto, nessuna per Salute), pulsante "modifica".
- **Sotto-aree:** righe compatte con nome e conteggio.
- **Progetti:** card o righe con nome, `fase` se presente, numero task aperti, data dell'ultima attività.
- **Task aperti:** elenco trasversale ai discendenti, con colonna `progetto`. Massimo 10 righe, poi link all'elenco completo.
- **Risorse:** righe con nome, numero documenti, `stato lettura` quando presente.

**Stati:** Area vuota; Area con solo progetti; Area archiviata (banner read-only, niente azioni di scrittura).

**Accettazione:** un task dentro un progetto compare nella lista trasversale con il progetto indicato, e non si duplica nella lista dei progetti.

---

### 7.4 Pagina di entità — task

**Obiettivo:** la pagina canonica. Deve mostrare con chiarezza tre zone diverse.

**Struttura (desktop):**

- **Header:** titolo (editabile inline), breadcrumb `Relazioni / Anniversari`, stato come **campo core** accanto al titolo, non come property eliminabile.
- **Zona 1 — Campi core:** griglia a due colonne con `Stato`, `Scadenza`, `Space`, `Ricorrenza` (se presente). Ogni campo ha etichetta sopra, valore, e non ha una "x".
- **Zona 2 — Property:** griglia a due colonne con le definizioni applicabili a `task` in quello Space. Alcune vuote (`frequenza: —`, `costo: —`), una compilata (`occasione: anniversario`). Le property ereditate mostrano un'indicazione discreta della provenienza (`da Relazioni`) al passaggio del mouse o come testo secondario.
- **Property locali:** sotto le ereditate, un gruppo separato `Solo questa entità`, con le property locali e il controllo `Aggiungi proprietà locale`. Tipi fissi (testo, numero, data, checkbox, link), nessuna vista e nessuna ereditarietà (ADR-0024).
- **Zona 3 — Capability:** pannello separato, bordo leggero, titolo `Habit`, contenuto `Atti d'amore — 2 su 3 questo mese`, link `Apri in Habits`. Nessun controllo modificabile.
- **Note:** sotto le zone, un'area di prosa con titolo del documento di note, oppure uno stato vuoto `Crea una nota`.
- **Avviso valori orfani:** banner discreto sopra le property quando esistono valori non visibili.

**Stati:** task completato (titolo barrato leggero, stato diverso); task in ritardo (badge testuale); task senza proprietà compilate; task spostato con valore orfano; task senza note.

**Accettazione:** si distingue a colpo d'occhio cosa è campo core, cosa è property ereditata, cosa è property locale e cosa è fatto di capability. Nessuna "x" sui campi core. Le property non applicabili non compaiono affatto. Le property locali sono chiaramente marcate come `Solo questa entità`.

---

### 7.5 Elenco Knowledge di uno Space

**Obiettivo:** mostrare i documenti di uno Space con le colonne che derivano dalle definizioni.

**Struttura:**

- **Header:** nome dello Space, conteggio documenti, azione `Nuovo documento`.
- **Barra degli strumenti:** solo un campo di ricerca locale e un ordinamento predefinito (`Modificati di recente`). **Nessun** selettore di colonne, **nessun** filtro avanzato.
- **Tabella:** `Titolo`, `Stato lettura`, `Fonte`, `Modificato`. Le colonne esistono perché `stato lettura` e `fonte` sono definite per `doc` in quello Space; in un altro Space le colonne cambiano.
- **Righe:** 44 px, titolo in peso 500, seconda riga con un estratto di 60 caratteri.

**Stati:** Space senza documenti; documenti senza valori; ordinamento attivo.

**Accettazione:** nessun controllo per aggiungere o togliere colonne. Le colonne visibili sono spiegabili da una definizione esistente.

---

### 7.6 Pagina documento

**Obiettivo:** leggere e scrivere, con proprietà e backlink visibili ma non invadenti.

**Struttura:**

- **Header:** titolo grande, breadcrumb, badge di sensitivity se diversa da `personal`.
- **Property:** riga compatta con `stato lettura`, `fonte`, più un link `dettagli` per il resto.
- **Corpo:** tipografia di lettura, max-width 720 px, titoli h1/h2/h3, liste, quote, code block, tabella, immagine con didascalia, callout, toggle chiuso e aperto. Un wikilink è visivamente distinto da un link esterno; un wikilink **rotto** ha sottolineatura tratteggiata e tooltip `Documento non trovato`.
- **Pannello backlink (desktop, colonna destra 280 px):** `Linkato da` con 2 voci: titolo del documento e il blocco che contiene il link in forma di estratto.
- **Mobile:** il pannello backlink diventa una sezione in fondo.

**Stati:** documento vuoto (placeholder del corpo); documento con solo un link rotto; documento archiviato.

**Accettazione:** il corpo non ha toolbar sempre visibile: la formattazione compare su selezione o con una barra compatta in cima. Il pannello backlink non ruba spazio al testo su 1440.

---

### 7.7 Ricerca

**Obiettivo:** ritrovare in due secondi, da tastiera.

**Struttura:** overlay centrato, larghezza 640 px, input grande in alto, risultati sotto, raggruppati per documento. La ricerca v1 cerca **solo documenti**, non task o Space.

- **Riga risultato:** titolo del documento, breadcrumb dello Space, snippet con il termine evidenziato, conteggio `3 blocchi`. Se il documento è `restricted`, badge testuale.
- **Stato iniziale:** suggerimenti (`Cerca in tutti gli Space`, `Filtra per Space`), nessun risultato inventato.
- **Stato vuoto:** `Nessun risultato per "…"` con suggerimento di cercare per titolo.
- **Navigazione:** frecce su/giù, invio apre, esc chiude. Il focus resta nell'input.

**Accettazione:** nessun filtro con sintassi, nessuna colonna, nessuna anteprima laterale. Un solo significato di "cerca": documenti, non task o Space.

---

### 7.8 Vista Habit

**Obiettivo:** vedere le evidenze giorno per giorno e, allo stesso tempo, lo score del periodo. La griglia non è lo score.

**Struttura:**

- **Header:** `Habit`, filtro per Area, `Nuovo habit`.
- **Griglia principale:** una riga per habit, con nome, Area, progresso e stato del periodo, pulsante di check-in; una colonna per giorno (15 passati, oggi, 15 futuri) con le evidenze. La pausa è un badge visibile.
- **Dettaglio:** score del periodo, streak, storico per periodo con stato e linea di forza campionata a fine periodo (ADR-0019); fonti attive e storico delle evidenze.
- **Esempi da mostrare:** un habit giornaliero, uno settimanale, uno mensile e uno in pausa nello stesso elenco.

**Accettazione:** la griglia mostra le evidenze, non lo score. Ogni habit mostra sempre il progresso e lo stato del proprio periodo; il grafico di forza resta per periodo e non diventa una griglia giornaliera.

---

## 8. Componenti ricorrenti da definire

- Riga di elenco (task, progetto, documento, habit) con densità 40–44 px.
- Badge di stato, badge di periodo, badge di sensitivity.
- Campo core vs property: stessa griglia, gerarchia visiva diversa.
- Pannello di capability (bordo, titolo, link).
- Banner informativo per valori orfani, link rotti, Area archiviata.
- Stato vuoto con una sola azione.
- Overlay di ricerca.
- Toggle tema light/dark.

---

## 9. Responsive

- **1440:** come descritto.
- **900:** sidebar a rail 64 px, dashboard a colonna singola, pagina entità a una colonna con property sotto il titolo, backlink in fondo.
- **390:** navigazione inferiore con quattro voci (Dashboard, Aree, Habit, Cerca), azioni in un menu, tabelle Knowledge trasformate in righe con due campi, nessun scroll orizzontale.

---

## 10. Varianti richieste (facoltative ma utili)

Solo su tre assi:

1. **Navigazione:** sidebar + topbar / rail di icone + pannello contestuale / top nav + command palette.
2. **Dashboard:** griglia di card / colonna singola prioritizzata / due colonne con focus.
3. **Pagina di entità:** property in rail a destra / property sotto il titolo a tutta larghezza / tab (panoramica, proprietà, note).

Per ogni variante: una frase su cosa guadagna e cosa perde. Non servono altre varianti.

---

## 11. Cosa consegnare

- Un prototipo responsive unico con le otto schermate, verificato a 1440, 900 e 390 px.
- Una pagina di **token** (colori light/dark, tipografia, spaziature, raggi, bordi).
- Una pagina di **componenti** con gli stati principali (default, hover, attivo, vuoto, errore, disabilitato).
- I nomi delle superfici coerenti con la tabella della sezione 5.
- Per ogni schermata, una nota di una riga su cosa è stato deciso e cosa resta aperto.

## 12. Cosa non disegnare

- Costruttori di viste, filtri, colonne, raggruppamenti.
- Editor di property di Space o di tipi. Il controllo per le property locali di un'entità è ammesso con i tipi fissi di ADR-0024.
- Trascinamento di pagine, alberi di pagine annidate, blocchi riordinabili.
- Sidebar di blocchi tipo Notion, emoji come stato, avatar e social proof.
- Grafici e KPI finti, gamification, badge celebrativi.
- Dashboard con card tutte uguali.

---

## 13. Glossario minimo

- **Space:** contenitore primario; può essere Area, Progetto o Risorsa.
- **Area:** Space di primo livello, può contenere sotto-aree, progetti e risorse.
- **Risorsa:** Space che raccoglie documenti.
- **Task:** azione con una o più occorrenze; lo stato vive sull'occorrenza.
- **Property:** attributo aperto e tipizzato, definito su uno Space e applicabile a tipi di entità; il valore sta sull'entità.
- **Campo core:** attributo obbligatorio dell'entità, non eliminabile.
- **Capability:** modulo opzionale che aggiunge comportamento a uno Space (Habit, Knowledge, Learning).
- **Habit:** abitudine valutata su un periodo (giorno, settimana, mese, anno); non è una sequenza di giorni.
- **Periodo:** intervallo di valutazione dell'habit; lo score è binario, il progresso è separato.
- **Nota:** documento collegato a un'entità, non un campo di testo.
