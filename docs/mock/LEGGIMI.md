# Nando — prototipo

Aprire `index.html` nel browser. Non serve installare dipendenze.

- `index.html`: ingresso del prototipo con le otto superfici del brief più il Calendario.
- `styles.css`: token light/dark, layout e componenti.
- `app.js`: dati dimostrativi, navigazione e interazioni locali.
- `habit-model.js`: habit, configurazioni, pause, fonti, evidenze e derivazioni (score, forza, streak).
- `habit-analytics.js`: dettaglio Habit, storico per periodo, fonti, calendario delle evidenze e dialoghi.
- `design.html`: pagina di token, componenti, stati e note per schermata.
- `calendar-m2.js`, `calendar-m2.css`: **prototype NAS-155 (M2) e NAS-160 (M3)**, da buttare. Sostituiscono Dashboard e Calendario con il modello di M2, e aggiungono serie ricorrenti e notifiche di M3 (vedi sotto).

## Prototype M2 — Giornata (NAS-155)

Ora dimostrativa: 28/10/2026 09:30. `calendar-m2.js` aggiunge task demo con id 9001–9013: range all-day e timed, scadenze a un'ora, task in ritardo e task senza data.

- **Dashboard:** Oggi è diviso in In ritardo, In svolgimento (range iniziato e non ancora scaduto; rinominato per non confondersi con lo stato «In corso» della board) e Scade oggi, con al massimo 7 righe e «Mostra tutte (N)». La checkbox completa e mostra un toast con «Annulla» (rettifica); ⤼ salta. «Prossimi» non è più una lista sotto Oggi. Ci sono tre varianti: la scelta è B, che ora è il default; le altre si vedono con `?variant=A` o `?variant=C`, e solo allora compare la barra viola (anche con i tasti ← →):
  - **A · Striscia + Agenda:** dentro Oggi c'è una striscia dei 7 giorni con il numero di task per giorno; cliccando un giorno il widget mostra quel giorno. L'orizzonte lungo è nella vista Agenda del Calendario, con un selettore 7/15/30 giorni.
  - **B · Tab + Board Task** (la scelta dopo il primo giro): in dashboard le tab di C; nella sidebar la voce «Task» apre una **board per stato** con le colonne Da fare, In corso e Fatto (solo gli ultimi 7 giorni). Si sposta una card trascinandola o con i link «→ colonna»: verso Fatto registra un Completion con il toast «Annulla», uscendo da Fatto registra una rettifica, verso In corso registra «iniziato». Filtri: Space e scadenza (Tutte, 7, 15 o 30 giorni; con un orizzonte attivo i task senza data sono nascosti). Introduce lo stato `in_progress`: va emendato ADR-0004.
  - **C · Tab in dashboard:** il widget ha due tab, Oggi e Prossimi 7 giorni.
- Un range compare anche nel giorno di inizio, con l'etichetta «inizia».
- **Calendario:** viste Mese, Settimana, Giorno e Agenda. Il click su una voce apre un popover con Completa, Salta, Riapri e Apri.
- **Drag** (solo desktop, con finestra di almeno 900 px e mouse): si trascinano solo le occorrenze aperte. La durata resta uguale; un all-day resta all-day e un timed mantiene l'ora se cade su un giorno. La maniglia in basso di un blocco timed ne cambia la fine.
- **Pannello «senza data»** nella vista Settimana, con filtro per Space. Sul giorno o sulla riga all-day il task riceve una scadenza all-day; su uno slot orario, una scadenza a quell'ora.
- Il riquadro «Prototype NAS-155» in fondo alla pagina mostra l'ultima azione, lo Schedule e lo storico del task modificato, e ripristina i dati demo.

Limiti: date naive nell'ora locale del browser, nessuna verifica di `@mantine/schedule`, storico non mostrato nella pagina task, range timed di più giorni non resi nella griglia oraria.

## Prototype M3 — Ricorrenze e notifiche (NAS-160)

Segue ADR-0029. Ogni Task ricorrente è una definizione con regola, ancora e promemoria; le occorrenze stanno fra i task (id da 20001) con `seriesId` e `genKey`, il giorno generato dalla regola. Le occorrenze si materializzano per 30 giorni. Le notifiche non sono salvate: si ricavano da occorrenze, promemoria e ora demo, con lo stato letto o rimosso per notifica.

Serie demo:

- **Meditare 10 minuti:** ogni giorno, «Nessun promemoria», ignorata dal 21 al 27 ottobre. Mostra i ritardi raggruppati e «Salta le precedenti».
- **Allenamento:** lun, mer e ven dalle 18:30 alle 19:30, con promemoria predefinito. Sostituisce il task 8 di `app.js`, che aveva la ricorrenza solo come etichetta.
- **Pagare l'affitto:** ogni mese dal 31 agosto; settembre cade il 30, cioè fine mese.
- **Call settimanale Studio X:** il giovedì alle 10:00, promemoria personalizzato a 15 minuti. L'occorrenza di giovedì 29 è stata spostata a venerdì 30 alle 11:00 ed è «modificata».

Cosa si prova:

- **Pagina task → Ripete:** apre il dialog della ripetizione.
  - Campi: frequenza, intervallo, giorni (settimanale), fine (mai, dopo N volte, fino al).
  - Mostra le prossime cinque date.
  - Avvisi: «ultimo giorno del mese» dal 29 al 31, 28 febbraio per il 29 febbraio, «serve una scadenza» se il task non ne ha una.
  - Su un task una tantum crea la serie: l'occorrenza esistente diventa la prima.
  - Sulla bozza di «Cattura rapida» la regola resta in attesa e si applica a «Crea task». Senza scadenza la riga dice «serve una scadenza»; la bozza ha solo la data, quindi la serie nasce di un giorno intero.
  - «Non si ripete» toglie la regola: annulla le future e tiene la prossima, e il dialog dice quante prima di salvare.
- **Scope di modifica:**
  - Cambiare la regola da un'occorrenza che non è la prima chiede «Questa e le future» o «Tutta la serie». Dalla prima si applica a tutta la serie, senza chiedere.
  - Cambiare la data dalla pagina task, trascinare o ridimensionare nel calendario chiede «Solo questa», «Questa e le future» o «Tutta la serie». Sulla prima occorrenza «Questa e le future» non compare, e una riga dice perché.
  - «Annulla» ed Esc non cambiano nulla.
- **Serie nelle viste:**
  - L'icona ↻ compare in righe, card, chip e popover, con la regola nel tooltip. «Modificata» marca le eccezioni.
  - Oggi raggruppa i ritardi della stessa serie in una riga con «+N precedenti» e «Salta le precedenti».
  - La board mostra per ogni serie i ritardi, le occorrenze in corso e la prossima, con «poi …» per la data successiva. «Salta le N precedenti» sta solo sull'ultimo ritardo della serie, anche nel popover del calendario.
- **Campanella** nella topbar, anche su telefono, con badge delle non lette. Il popover:
  - elenca le attive per priorità, poi le più recenti;
  - un clic apre il task e segna come letta; × rimuove la notifica; c'è «Segna tutte come lette»;
  - un bordo rosso e il testo «Scadeva…» marcano l'overdue;
  - in fondo porta a «Impostazioni dei promemoria».
- **Impostazioni** (voce in fondo alla sidebar; su telefono si arriva dalla campanella): offset di default per i task di un giorno intero e per quelli con orario, con il numero di promemoria in programma che li usano.
- **Pagina task → Promemoria:** «Predefinito · …», «Personalizzato» (compare la scelta dell'offset), «Nessun promemoria» (con «il ritardo arriva comunque»). Su una serie vale per tutta la serie, come il titolo.
- **Riquadro del prototype:**
  - cambia l'ora demo (09:30 → 23:59), per vedere scattare i promemoria: alle 18:05 c'è quello di Allenamento;
  - elenca le prossime notifiche in programma: cambiando un offset si vede il `triggerAt` spostarsi;
  - mostra serie, `genKey`, eccezione e promemoria dell'ultimo task modificato.

Scelte proposte, da confermare:

- La ripetizione si modifica in un dialog che parte dalla riga «Ripete» della pagina task, non in linea fra le proprietà.
- Nello scope è preselezionato «Solo questa» per una data e «Questa e le future» per una regola.
- Impostazioni sta in fondo alla sidebar sopra Ricerca e, su telefono, nel piede del popover della campanella: niente voce nella bottom nav.
- Una notifica nuova aggiorna solo il badge, senza toast (ADR-0029).

Emerso dal mock, da decidere:

- **Overdue e dueSoon della stessa occorrenza.** Con il thread dell'overdue per serie, l'overdue non fa più supersede del dueSoon della sua occorrenza, e resterebbero due segnali. Il mock risolve dueSoon e starts quando scatta l'overdue della stessa occorrenza: va aggiunto ad ADR-0029 e a NAS-166.
- **Spostare un giorno di una serie su più giorni** con «Tutta la serie» (es. il mercoledì di lun/mer/ven portato a giovedì) cambia solo quel giorno della settimana: lun/gio/ven. Per le altre frequenze si sposta l'ancora. È un dettaglio di NAS-165.
- **Board e serie giornaliere ignorate:** la board mostra tutti i ritardi della serie (sette card per Meditare), mentre Oggi li raggruppa. Se il rumore pesa, anche la board può raggruppare.
- **Titolo e Space** valgono per tutto il Task: cambiarli da un'occorrenza non chiede lo scope.

Limiti: date naive senza DST, testo delle notifiche calcolato a ogni render invece che alla registrazione, nessun polling, il campo Scadenza della pagina task mostra solo la data.

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

Il dettaglio Habit e il contratto `GET /habits/:id/history` sono in ADR-0025. Il prototipo non implementa la modifica della granularità, la riattivazione di un habit archiviato né il completamento automatico del task dal check-in: sono decisioni o lavoro di implementazione. La ricorrenza dei task è nel prototype M3 (sopra); skip e riapertura sono in quello di M2.

Il prototipo è HTML/CSS/JavaScript, non sorgente React/Mantine né file Figma. Gli stati di primo avvio e archivio sono illustrati nella pagina componenti; la lista Habit mostra anche gli archiviati. L’editor documento modifica testo semplice, non è un editor a blocchi completo. Nessuna esportazione o verifica visuale o a11y automatica è stata effettuata.
