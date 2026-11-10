# 0023 — Mock di shell e dashboard: schermate, varianti e catalogo widget

- **Stato:** accettato
- **Data:** 2026-11-06
- **Ticket:** NAS-62 — Dashboard e shell: navigazione, widget, layout
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete
- **Dipende da:** ADR-0013, ADR-0017, ADR-0018, ADR-0019, ADR-0024
- **Chiarisce:** ADR-0014 (la griglia giornaliera mostra evidenze, non score), ADR-0019 (la forza resta per periodo)

## Contesto

NAS-62 chiedeva un prototipo di shell e dashboard: come si naviga fra Space e capability, catalogo widget v1, layout persistente e responsive, cosa merita attenzione e cosa resta in dettaglio. Il brief è in `docs/design/nas-62-brief-open-design.md`.

L'artefatto è un prototipo HTML/CSS/JavaScript in `docs/mock/`, non un file Figma e non sorgente React/Mantine:

- `index.html` — ingresso del prototipo;
- `styles.css` — token, layout, componenti, responsive, temi;
- `app.js` — dati dimostrativi, navigazione, interazioni;
- `habit-analytics.js` — dettaglio Habit: score per periodo, forza, calendario delle evidenze, frequenza;
- `design.html` — token, componenti, stati e tabella delle schermate;
- `LEGGIMI.md` — istruzioni, assunzioni e limiti.

Il mock è un riferimento di gerarchia, densità e navigazione. Non è un prototipo interattivo completo del prodotto.

## Decisione

### Direzione scelta

- **Shell:** sidebar da 248 px, rail da 64 px sotto 1024 px, bottom nav a 390 px; topbar da 56 px con breadcrumb, ricerca, tema e azione primaria. Un solo contenitore persistente.
- **Dashboard:** due colonne 2/3–1/3 a 1440 px, una colonna a 900 e 390 px. La colonna principale dà priorità a Oggi; la laterale a Habit, note, progetti e Inbox.
- **Area:** header con nome e tipo, progetti, sotto-aree/risorse, elenco trasversale dei task aperti con il progetto, documenti. La discendenza non diventa un albero infinito.
- **Pagina entità:** tre zone visive — campi core, property (ereditate e locali), pannello capability — più le note. I campi core non hanno la "x"; le property ereditate dichiarano l'origine; le locali dichiarano `Solo questa entità` (ADR-0024).
- **Knowledge:** tabella con colonne derivate dalle definizioni dello Space; nessun selettore di colonne, nessun filtro avanzato. A 390 px le righe mostrano titolo e stato.
- **Documento:** larghezza di lettura 720 px, pannello backlink a 280 px che scende sotto il testo sotto 1024 px; wikilink e link rotto distinti; fonte con URL dimostrativo.
- **Ricerca:** overlay da 640 px, tastiera-first, solo documenti, raggruppata per documento, snippet e conteggio blocchi.
- **Habit:** griglia giornaliera delle evidenze come vista primaria; ogni riga mostra progresso e stato del periodo; il dettaglio mostra score per periodo, streak e forza campionata a fine periodo, calendario annuale delle evidenze e frequenza. La griglia non è lo score.
- **Calendario:** vista mensile sui task; estensione rispetto alle otto schermate del brief, ma dentro la v1 (NAS-55, vista su TaskOccurrence).

### Token

- Una sola famiglia system UI; pesi 400/500/600; numeri tabulari.
- Eccezione dichiarata: il monogramma del marchio (quadrato 28 px con la "N") usa un serif, `Georgia`
  con fallback, tokenizzato in `theme.other.brandFontFamily` e consumato solo da `.brandMark`. Nessun
  altro punto dell'interfaccia usa una seconda famiglia.
- Tipografia 12 / 13 / 14 / 16 / 20 / 28 px.
- Spaziatura 4 / 8 / 12 / 16 / 24 / 32 px.
- Raggi 6 / 8 px; bordi 1 px.
- Light e dark con pari dignità.
- Accento neutro: `#262626` / `#eeeeee`; superficie tenue `#f5f5f5` / `#222222`; errore `#a53e3e` / `#f1a1a1`.
- L'accento blu delle prime iterazioni non è stato adottato; l'artefatto finale è monocromatico.
- Il colore non è mai l'unico portatore di significato: stati e badge hanno etichetta testuale.

### Catalogo widget della dashboard

1. **Oggi** — task con scadenza oggi o in ritardo, massimo 7 righe, con cattura rapida inline.
2. **Prossimi 7 giorni** — raggruppati per giorno.
3. **Habit** — riga compatta di evidenze a 7 giorni, progresso e stato del periodo, check-in.
4. **Note recenti** — tre documenti con Space e tempo relativo.
5. **Progetti in corso** — elenco compatto dei progetti, con Area.
6. **Inbox** — conteggio delle entità senza Space.
7. **Aree** — disponibile nella navigazione e nella pagina Aree; non un widget separato nella dashboard.

### Catalogo schermate

| Schermata | Decisione | Limite |
| --- | --- | --- |
| `shell` | Sidebar 248, rail 64 a 900, bottom nav a 390; topbar 56 | Il nome utente non è fornito: “Spazio personale” |
| `dashboard` | Due colonne a 1440, una a 900/390; Oggi ha la priorità | Data di riferimento fissa al 28/10/2026 |
| `area` | Progetti, sotto-aree/risorse, task trasversali con progetto, documenti | Archivio mostrato come stato di componente |
| `entity-task` | Campi core, property ereditate, property locali, capability, note | Il pattern locale è dimostrato sul task; è generico (ADR-0024) |
| `knowledge-list` | Colonne dallo Space; a 390 righe con titolo e stato | URL della fonte dimostrativo (`example.org`) |
| `document` | Testo leggibile e backlink laterali, in fondo sotto 1024 | Backlink dimostrativi aggiunti al prototipo |
| `search` | Overlay 640, solo documenti, raggruppati per documento, frecce/invio/Esc | Ricerca locale sui dati del prototipo |
| `habit-view` | Griglia giornaliera delle evidenze; score e forza per periodo | Storico assente: “Non valutato”; streak iniziali dal brief |
| `calendar` | Vista mensile sui task, apertura del task | Estensione fuori dalle otto schermate del brief |

### Varianti

Le varianti opzionali del brief (navigazione, densità dashboard, layout pagina entità) non sono state generate. La direzione scelta è quella dell'artefatto: sidebar + topbar, dashboard a due colonne, property sotto il titolo a tutta larghezza. Le varianti restano un'esplorazione futura, non un blocco per NAS-62.

### Estensioni e limiti

- **Calendario** e **Habit analytics** sono estensioni oltre le otto schermate; sono dentro la v1 e vanno considerate nella roadmap.
- **Property locali** sono l'eccezione controllata di ADR-0024; non sono un property builder e non entrano nelle viste.
- **Icona del progetto** è un'affordance del prototipo, non parte del riferimento di prodotto.
- **Editor documento** modifica testo semplice, non è l'editor a blocchi di Knowledge.
- **Stati di primo avvio e archivio** sono illustrati nella pagina componenti; non sono simulati nella UI del prodotto.
- **Ricorrenza** non è provata: nei dati finti non c'è un task ricorrente.
- **Skip/cancel** non sono coperti dal mock; il flusso ADR-0013 li richiede e vanno aggiunti nell'implementazione o in NAS-60.
- Nessun backend, autenticazione o automazione AI; nessuna verifica visuale o a11y automatica.

## Schema concettuale

```text
Shell persistente
  ├─ Sidebar (248 / 64 / bottom nav)
  ├─ Topbar (breadcrumb, ricerca, tema, azione)
  └─ Contenuto
       ├─ Dashboard
       │    ├─ Oggi
       │    ├─ Prossimi 7 giorni
       │    ├─ Habit (evidenze + periodo)
       │    ├─ Note recenti
       │    ├─ Progetti in corso
       │    └─ Inbox
       ├─ Area / Space
       ├─ Entità (core / ereditate / locali / capability / note)
       ├─ Knowledge (tabella derivata dallo Space)
       ├─ Documento (corpo + backlink)
       ├─ Ricerca (overlay documenti)
       ├─ Habit (griglia evidenze + dettaglio periodo)
       └─ Calendario
```

## Invarianti

1. Una sola shell; la navigazione non cambia fra le schermate.
2. Nessun costruttore di viste, colonne, filtri o gerarchie.
3. Le property di Space sono fisse; le locali sono l'eccezione di ADR-0024, visibili solo nella pagina dell'entità.
4. La griglia Habit mostra evidenze; score e forza restano per periodo.
5. La ricerca v1 cerca solo documenti.
6. Il Calendario è una vista sui task, non un'entità.
7. Il mock è un riferimento, non codice di produzione: niente React/Mantine, niente backend.
8. Le varianti non sono incluse; la direzione scelta è quella registrata qui.
9. I token sono la base del tema Mantine; i componenti ricorrenti si estraggono alla terza occorrenza, non prima (ADR-0013).

## Conseguenze

- **NAS-62:** il mock è chiuso con l'artefatto `docs/mock/` e questo ADR. Rimuove uno dei blocchi di NAS-53; NAS-60 resta l'altro.
- **NAS-60:** resta aperto per il dettaglio Habit (fonti attive, storico delle evidenze, pausa). Il mock copre la griglia e il dettaglio analytics, non l'intero flusso.
- **NAS-53:** la roadmap può usare il catalogo schermate e widget come riferimento.
- **ADR-0014/0019:** non cambiano. La griglia giornaliera è evidenza; score e forza restano per periodo.
- **ADR-0017/0024:** la pagina entità include le property locali; ADR-0017 è emendato.
- **ADR-0018:** la ricerca resta sui documenti; il mock non introduce ranking globale.
- **Brief NAS-62:** aggiornato nelle sezioni 3.1, 3.7, 7.2, 7.4, 7.7 e 7.8.
- **Implementazione:** il tema Mantine parte dai token; la shell, la dashboard e le schermate sono il riferimento di gerarchia e densità. Il prototipo non si porta in produzione.
- **Design system:** nessun pacchetto `ui`, nessuno Storybook, nessuna documentazione formale (ADR-0013).

## Alternative scartate

- **24 frame statici:** il prototipo responsive unico prova meglio il comportamento a 900 e 390 e non duplica i dati.
- **Accento blu:** le prime iterazioni lo usavano; l'artefatto finale sceglie un accento neutro, coerente con la direzione sobria.
- **Score giornaliero degli Habit:** la griglia mostra evidenze; lo score resta binario per periodo (ADR-0014).
- **Ricerca globale documenti + task + Space:** rimandata; la v1 cerca documenti (ADR-0018).
- **Property builder per lo Space:** resta escluso; le locali sono l'eccezione controllata (ADR-0024).
- **Icona del progetto come parte del riferimento:** è un extra del prototipo, non una decisione di prodotto.
- **Varianti obbligatorie:** il brief le chiedeva come facoltative; la direzione scelta è una sola.

## Questioni aperte

- La UI della ricorrenza e lo skip/cancel delle occorrenze vanno progettati: il mock non li copre.
- L'icona del progetto resta o esce dal riferimento?
- Le varianti di navigazione, dashboard e pagina entità vanno esplorate o la direzione attuale è definitiva?
- Il passaggio dai token del prototipo al tema Mantine richiede una verifica visiva dedicata.
- Gli stati di primo avvio e archivio vanno portati nelle schermate reali, non solo nella pagina componenti.
