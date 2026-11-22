# Nando — prototipo

Aprire `index.html` nel browser. Non serve installare dipendenze.

- `index.html`: ingresso del prototipo con le otto superfici del brief più il Calendario.
- `styles.css`: token light/dark, layout e componenti.
- `app.js`: dati dimostrativi, navigazione e interazioni locali.
- `habit-model.js`: habit, configurazioni, pause, fonti, evidenze e derivazioni (score, forza, streak).
- `habit-analytics.js`: dettaglio Habit, storico per periodo, fonti, calendario delle evidenze e dialoghi.
- `design.html`: pagina di token, componenti, stati e note per schermata.
- `calendar-m2.js`, `calendar-m2.css`: **prototype NAS-155**, da buttare. Sostituiscono Dashboard e Calendario con il modello di M2 (vedi sotto).

## Prototype M2 — Giornata (NAS-155)

Ora dimostrativa: 28/10/2026 09:30. `calendar-m2.js` aggiunge task demo con id 9001–9013: range all-day e timed, scadenze a un'ora, task in ritardo e task senza data.

- **Dashboard:** Oggi è diviso in In ritardo, In corso e Scade oggi, con al massimo 7 righe e «Mostra tutte (N)». La checkbox completa e mostra un toast con «Annulla» (rettifica); ⤼ salta. «Prossimi» non è più una lista sotto Oggi: ci sono tre varianti, che si scelgono con `?variant=` oppure con la barra viola in basso (o con i tasti ← →):
  - **A · Striscia + Agenda:** dentro Oggi c'è una striscia dei 7 giorni con il numero di task per giorno; cliccando un giorno il widget mostra quel giorno. L'orizzonte lungo è nella vista Agenda del Calendario, con un selettore 7/15/30 giorni.
  - **B · Pagina Task:** una nuova voce «Task» nella sidebar, con orizzonte 7/15/30 giorni, ritardi, in corso, lista per giorno, task senza data e filtro per Space. In dashboard resta solo Oggi, con una riga di riepilogo «Domani · Prossimi 7 giorni».
  - **C · Tab in dashboard:** il widget ha due tab, Oggi e Prossimi 7 giorni.
- Un range compare anche nel giorno di inizio, con l'etichetta «inizia».
- **Calendario:** viste Mese, Settimana, Giorno e Agenda. Il click su una voce apre un popover con Completa, Salta, Riapri e Apri.
- **Drag** (solo desktop, con finestra di almeno 900 px e mouse): si trascinano solo le occorrenze aperte. La durata resta uguale; un all-day resta all-day e un timed mantiene l'ora se cade su un giorno. La maniglia in basso di un blocco timed ne cambia la fine.
- **Pannello «senza data»** nella vista Settimana, con filtro per Space. Sul giorno o sulla riga all-day il task riceve una scadenza all-day; su uno slot orario, una scadenza a quell'ora.
- Il riquadro «Prototype NAS-155» in fondo alla pagina mostra l'ultima azione, lo Schedule e lo storico del task modificato, e ripristina i dati demo.

Limiti: date naive nell'ora locale del browser, nessuna verifica di `@mantine/schedule`, storico non mostrato nella pagina task, range timed di più giorni non resi nella griglia oraria.

## Percorsi

La dashboard è l’ingresso. Cliccare un task per aprire la sua pagina. Le quattro Aree portano a progetti e risorse. Knowledge presenta i documenti per Space. Habit mostra progressi per periodo. La ricerca si apre con Cmd/Ctrl+K e consente di raggiungere anche i task completati. C apre la cattura rapida quando non si sta scrivendo.

Nella schermata Habit si apre il dettaglio di un habit. Il dettaglio contiene, nell’ordine: periodo corrente, storico per periodo con forza, fonti attive e storico delle evidenze. `Configurazione` cambia l’obiettivo dal periodo successivo, mette in pausa o riprende. Il check-in propone le fonti attive collegate; `Altra azione` registra un check-in manuale. Le celle del calendario aprono il drawer del giorno, con provenienza e rettifiche.

L’interfaccia si adatta a desktop 1440, tablet 900 e mobile 390. Sopra 1320 px la lista Habit usa la griglia a 31 giorni e il dettaglio il calendario annuale; sotto, la lista usa 7 giorni e il dettaglio le ultime 12 settimane. Lo storico per periodo mostra 21 celle per gli habit giornalieri e 12 per settimana, mese e anno. Non c’è scroll orizzontale.

## Assunzioni e limiti

Data dimostrativa: 28 ottobre 2026. Nessun backend. Dati conservati nel browser se localStorage è disponibile, altrimenti solo durante la sessione. Per ripartire dai dati iniziali rimuovere la chiave `nando-prototype-v2` dall’archiviazione del browser.

I sette habit coprono gli stati: giornaliero aperto (Meditare), settimanale con cambio target (Palestra), mensile tutto raggiunto (Atti d’amore), mensile con streak rotta (Leggere), in pausa (Sonno 7h), nuovo senza periodi valutati (Journaling), archiviato (Corsa). Le evidenze sono deterministiche; la forza è calcolata on read con la formula di ADR-0019. Una evidenza di Atti d’amore è rettificata, una è precedente allo storico dettagliato e una proviene da un evento Space.

Il brief contiene dati aggregati mensili per Meditare ma non indica l’esito del 28 ottobre: il check-in odierno parte non registrato; il primo check-in porta il totale mensile da 24 a 25 giorni.

La fonte del documento usa un URL dimostrativo (`example.org`), non un contenuto reale. I backlink sono dimostrativi: due documenti di esempio rimandano al documento principale. Il diagramma del documento è SVG locale, senza immagini esterne. I contenuti di prosa sono esempi, non consulenza sanitaria.

Le proprietà locali sono dimostrate sul task; il modello è generico per ogni entità (ADR-0024). La ricerca cerca solo documenti, come deciso in ADR-0023.

Il dettaglio Habit e il contratto `GET /habits/:id/history` sono in ADR-0025. Il prototipo non implementa la modifica della granularità, la riattivazione di un habit archiviato, la UI di ricorrenza/skip/cancel dei task né il completamento automatico del task dal check-in: sono decisioni o lavoro di implementazione. Il task `Allenamento` mostra la ricorrenza come dato di sola lettura.

Il prototipo è HTML/CSS/JavaScript, non sorgente React/Mantine né file Figma. Gli stati di primo avvio e archivio sono illustrati nella pagina componenti; la lista Habit mostra anche gli archiviati. L’editor documento modifica testo semplice, non è un editor a blocchi completo. Nessuna esportazione o verifica visuale o a11y automatica è stata effettuata.
