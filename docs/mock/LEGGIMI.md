# Nando — prototipo

Aprire `index.html` nel browser. Non serve installare dipendenze.

- `index.html`: ingresso del prototipo con le otto superfici del brief più il Calendario.
- `styles.css`: token light/dark, layout e componenti.
- `app.js`: dati dimostrativi, navigazione e interazioni locali.
- `habit-model.js`: habit, configurazioni, pause, fonti, evidenze e derivazioni (score, forza, streak).
- `habit-analytics.js`: dettaglio Habit, storico per periodo, fonti, calendario delle evidenze e dialoghi.
- `design.html`: pagina di token, componenti, stati e note per schermata.

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
