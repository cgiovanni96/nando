# Nando — prototipo

Aprire `index.html` nel browser. Non serve installare dipendenze.

- `index.html`: ingresso del prototipo con le otto superfici del brief più il Calendario.
- `styles.css`: token light/dark, layout e componenti.
- `app.js`: dati dimostrativi, navigazione e interazioni locali.
- `design.html`: pagina di token, componenti, stati e note per schermata.

## Percorsi

La dashboard è l’ingresso. Cliccare un task per aprire la sua pagina. Le quattro Aree portano a progetti e risorse. Knowledge presenta i documenti per Space. Habit mostra progressi per periodo. La ricerca si apre con Cmd/Ctrl+K e consente di raggiungere anche i task completati. C apre la cattura rapida quando non si sta scrivendo.

L’interfaccia si adatta a desktop 1440, tablet 900 e mobile 390. I nomi delle otto superfici del brief, più il Calendario, sono conservati negli attributi `data-screen`. La shell è persistente; la ricerca è un dialogo.

## Assunzioni e limiti

Data dimostrativa: 28 ottobre 2026. Nessun backend. Dati conservati nel browser se localStorage è disponibile, altrimenti solo durante la sessione. Per ripartire dai dati iniziali rimuovere la chiave `nando-prototype-v1` dall’archiviazione del browser.

Il brief contiene dati aggregati mensili per Meditare ma non indica l’esito del 28 ottobre: il check-in odierno parte non registrato; il primo check-in porta il totale mensile da 24 a 25 giorni. Gli storici non forniti restano non valutati e le streak iniziali non vengono ricalcolate senza uno storico.

La fonte del documento usa un URL dimostrativo (`example.org`), non un contenuto reale. I backlink sono dimostrativi: due documenti di esempio rimandano al documento principale. Il diagramma del documento è SVG locale, senza immagini esterne. I contenuti di prosa sono esempi, non consulenza sanitaria.

Le proprietà locali sono dimostrate sul task; il modello è generico per ogni entità (ADR-0024). La ricerca cerca solo documenti, come deciso in ADR-0023. La vista Habit usa una griglia giornaliera di evidenze; score e forza restano per periodo.

Il prototipo è HTML/CSS/JavaScript, non sorgente React/Mantine né file Figma. Gli stati di primo avvio e archivio sono illustrati nella pagina componenti; non aggiungono comandi di simulazione alla UI del prodotto. L’editor documento modifica testo semplice, non è un editor a blocchi completo. Nessuna esportazione o verifica visiva automatica è stata effettuata.
