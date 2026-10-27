# Nando

Personal OS single-user: un solo proprietario organizza la propria vita in Space che compongono capability sopra un core sempre presente. Questo glossario fissa i termini di dominio; l'architettura — moduli, servizi, tabelle — resta fuori.

**Stato:** vivo. Una voce entra qui solo quando un ticket della mappa [Nando v1 — Fondazione decision-complete](https://linear.app/giocosta/issue/NAS-41/nando-v1-fondazione-decision-complete) la ratifica. I termini ancora aperti non compaiono.

## Language

### Organizzazione

**Space**:
Il contenitore primario che l'utente naviga e in cui compone più capability. Il `kind` è fissato alla creazione — area, project o resource — e Area non è un'entità separata.
_Avoid_: Area (come entità), cartella, workspace, archive (come kind)

**PARA**:
Convenzione che classifica gli Space in tre `kind` — area, project, resource — e tratta l'archivio come stato del lifecycle, non come quarto tipo. Non è una gerarchia parallela agli Space.
_Avoid_: Area come contenitore, archive come kind

**Archive**:
Stato di uno Space che lo rende read-only, lo nasconde dalle viste attive e lo esclude dagli aggregati, conservando storia ed evidenze. Si applica a cascata ai discendenti.
_Avoid_: kind, cancellazione, done

**Deletion**:
Stato reversibile che nasconde uno Space e i suoi discendenti e avvia la purge definitiva dopo una finestra di grazia. È distinta dall'archivio, che non elimina nulla.
_Avoid_: archive, hard delete (come sinonimo)

**Inbox**:
Vista globale delle entità senza Space proprietario. Non è uno Space e non ha lifecycle.
_Avoid_: Space di sistema, cartella

**Project completion**:
Stato di un Project che ha raggiunto il suo esito; è distinto dall'archivio, che lo toglie dalle viste attive.
_Avoid_: archive, done (come sinonimo di archiviato)

**Core**:
Insieme di strumenti sempre disponibili e mai opzionali: PARA/Space, Tasks, Calendar, Notifications e Person minima. Il core non dipende dalle capability e le capability lo usano come building block.
_Avoid_: capability, modulo, piattaforma

**Capability**:
Unità di dominio opzionale che l'utente attiva dentro uno Space: Knowledge, Habits, Learning, Relationships. Non è un confine di codice e non è un core tool.
_Avoid_: modulo, feature, plugin, core

**SpaceCapability**:
Record esplicito che dichiara una capability opzionale attiva in uno Space, con la sua configurazione e il suo stato. Le core tool sono implicite e non richiedono attivazione.
_Avoid_: modulo, plugin, abilitazione implicita, core

**Extension**:
Capability che specializza un motore più ampio invece di definirne uno proprio: Languages per Learning, Romantic per Relationships.
_Avoid_: modulo, plugin

### Tasks

**Task**:
Definizione di un'azione o di un evento pianificato: titolo, note, Space proprietario e regola di ricorrenza opzionale. Lo stato vive nelle sue Occurrences, non nel Task. Ciò che l'utente chiama evento è una Occurrence con Schedule.
_Avoid_: todo, item, attività (da solo), Event (come entità)

**TaskOccurrence**:
Istanza schedulata di un Task, con Schedule opzionale, luogo, partecipanti e stato; un Task una tantum ne ha una sola.
_Avoid_: istanza, task (come sinonimo), evento (come entità)

**Schedule**:
Value object del tempo di una TaskOccurrence: `allDay`, `from` opzionale, `to` e timezone. `to` è la scadenza; `from` presente indica un intervallo che occupa il calendario.
_Avoid_: dueDate (come stringa), evento

**Recurrence rule**:
Regola RRULE (subset RFC 5545) che genera le Occurrences di un Task; si valuta nella timezone del Task.
_Avoid_: schedulazione, ripetizione

**Skip**:
Chiusura di una singola Occurrence senza completamento e senza Evidence; la serie continua.
_Avoid_: cancel, delete

**Cancel**:
Chiusura di un Task o di una Occurrence senza completamento; non produce Evidence. Cancellare una serie chiude le occorrenze future.
_Avoid_: delete, archive

**Overdue**:
Stato derivato di una TaskOccurrence `open` la cui scadenza `to` è passata; non è uno stato memorizzato e non produce una transizione.
_Avoid_: scaduto (come stato), late

### Calendar e notifiche

**Calendar**:
Vista core sulle TaskOccurrence con Schedule: non è un'entità, non ha tabella propria e non duplica i Task.
_Avoid_: Event (come entità), modulo Calendar, agenda

**Notification**:
Messaggio generato dal servizio core Notifications e consegnato in-app o via email. Non è una capability e non conosce il dominio che l'ha richiesto.
_Avoid_: reminder (come sinonimo), evento, alert

### Persone e accesso

**User**:
Principal di autenticazione. Esiste solo per l'accesso e non porta dati di dominio; il proprietario di Nando è implicito in ogni record.
_Avoid_: Person, account (come entità di dominio), utente (per le persone della vita)

**Person**:
Una persona reale del dominio, con identità stabile e indipendente dai contatti esterni. In v1 esiste in forma minima — `id`, `displayName` — come core, usata da Calendar per i partecipanti; Relationships la arricchirà. Il proprietario dell'app non è una Person.
_Avoid_: User, contatto, profilo

**Context**:
Situazione o relazione in cui un fatto, una memoria o un'associazione vale: amicizia, lavoro, un progetto. Riguarda il significato, non il permesso.
_Avoid_: scope, tag, categoria

**Scope**:
Perimetro di ciò che un attore o una chiamata AI può leggere o scrivere. Riguarda il permesso, non il significato.
_Avoid_: context, filtro, vista

### Verità e provenienza

**Signal**:
Dato grezzo ricevuto da una fonte esterna o da un import, non interpretato e non ancora convertito in un fatto.
_Avoid_: evento, evidenza, dato (da solo)

**Evidence**:
Occorrenza registrata che prova che qualcosa è accaduto e può contribuire a uno score o a una cronologia. Nasce da un'azione manuale, da un task o da un segnale di capability.
_Avoid_: completion, check, log

**Rectification**:
Correzione append-only che supersede o annulla un'evidenza o un completamento, con motivo e provenienza; l'originale resta.
_Avoid_: delete, undo (come sinonimo), soft delete

**Interaction**:
Evidence specializzata in un incontro fra persone, con partecipanti e contesto. La sola presenza in calendario non la rende confermata.
_Avoid_: meeting, evento (da solo)

**Source**:
L'origine di un dato — connettore, persona, import, AI, inserimento manuale — con identità e lifecycle propri. Una Source si può revocare.
_Avoid_: provenance, origine (vago)

**Provenance**:
Il record attaccato a un oggetto che dice da quale Source viene, chi lo ha creato o trasformato, quando e attraverso quale derivazione.
_Avoid_: source, audit log

**Confidence**:
Campo della Provenance che esprime quanto ci fidiamo di un valore o di un'asserzione. Non è un'entità e non ha storia propria.
_Avoid_: score, certezza

### Proprietà e claim

**Property**:
Definizione di un campo aperto e tipizzato, condivisa nel kernel e usabile da più capability. Non è un campo core del dominio.
_Avoid_: fact, colonna, attributo

**PropertyValue**:
Valore di una Property su un'entità, con la sua Provenance. È il mattone comune di attributi aperti e asserzioni; il comportamento dipende dalla capability che lo valuta.
_Avoid_: fact, campo, valore (da solo)

**Lifecycle policy**:
Regola che una capability lega a una coppia (tipo di entità, Property): per esempio «asserzione con validità e supersessione» per PersonFact. Il valore resta generico, il comportamento è codice.
_Avoid_: stato, workflow

**Fact**:
Ruolo di una PropertyValue valutata con un lifecycle di asserzione: fonte, validità, confidence e supersessione. Un fatto superato resta storico, non viene cancellato.
_Avoid_: property, campo, dato

**Memory**:
Affermazione contestuale e situata, legata a un Context e a una finestra di validità; può scadere senza diventare falsa.
_Avoid_: nota, fatto, ricordo (vago)

### Associazioni

**Binding**:
Associazione con lifecycle che può produrre conseguenze, per esempio evidenze per un Habit. Ha stati propri — active, closed, disabled — e si chiude senza cancellare la storia.
_Avoid_: link, relazione, collegamento

**Link**:
Puntatore fra due entità senza lifecycle e senza conseguenze: non produce evidenze e non ha stati.
_Avoid_: binding, associazione

**Association**:
Ombrello che copre Binding e Link. Non è un'entità del modello.
_Avoid_: relazione (da sola)

### AI supervisionata

**Proposal**:
Modifica tipizzata e azionabile che attende approvazione — crea un task, collega un habit — con stato, provenienza e chiave idempotente.
_Avoid_: suggerimento, azione automatica

**Suggestion**:
Idea soft e dismissibile, senza effetto persistente se ignorata.
_Avoid_: proposta

**Candidate**:
Elemento interno di ranking o di bozza, mai presentato come entità all'utente.
_Avoid_: suggerimento

### Identità e occorrenze

**Activity identity** (`activityId`):
Identificatore condiviso dai record che descrivono la stessa azione, per esempio lo stesso appuntamento registrato due volte. Non è un'entità: è il valore che permette di deduplicare le evidenze.
_Avoid_: Activity (come entità), chiave deterministica, dedup per titolo, evento (come entità)

**Idempotency key**:
Chiave per comando che permette al server di restituire lo stesso risultato su replay invece di creare un duplicato.
_Avoid_: request ID, dedup key (per i comandi)

**EntityRef**:
Riferimento cross-module a un'entità: tipo + identificatore. Non è una foreign key e non implica una supertype comune.
_Avoid_: foreign key, puntatore

**Occurrence**:
Istanza datata di una definizione. In v1 è sempre una TaskOccurrence: si completa, si salta o si annulla individualmente.
_Avoid_: istanza, ricorrenza (come sinonimo), evento (come entità)

**Completion**:
Fatto datato che un'Occurrence è stata completata; per un evento significa che è avvenuto. Non è uno stato della serie o della definizione che l'ha generata.
_Avoid_: status, check, done, avvenuto (come stato separato)

### Interfaccia

**Widget**:
Tile di dashboard che mostra un dato o una vista in forma compatta. Non è una View.
_Avoid_: card, modulo

**View**:
Query salvata su entità, resa come tabella, board o lista. Non è un Widget.
_Avoid_: widget, tabella (come sinonimo)

**Block**:
Unità di contenuto dentro un documento Knowledge. Non è una View né un Widget.
_Avoid_: componente, sezione

## Termini deliberatamente esclusi

- **Module**: confine di codice che implementa una capability. È architettura, non dominio.
- **Event (come entità)**: una voce di calendario è una TaskOccurrence con Schedule; il termine resta solo nella UI.
- **Port / Outbox / Domain event**: pattern di comunicazione fra moduli, descritti nell'ADR-0003.
- **Component / Service / Feature**: vocabolario tecnico generico, non specifico di Nando.
