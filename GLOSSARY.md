# Nando

Personal OS single-user: un solo proprietario organizza la propria vita in Space che compongono capability. Questo glossario fissa i termini di dominio; l'architettura — moduli, servizi, tabelle — resta fuori.

**Stato:** vivo. Una voce entra qui solo quando un ticket della mappa [Nando v1 — Fondazione decision-complete](https://linear.app/giocosta/issue/NAS-41/nando-v1-fondazione-decision-complete) la ratifica. I termini ancora aperti non compaiono.

## Language

### Organizzazione

**Space**:
Il contenitore primario che l'utente naviga e in cui compone più capability. Il suo `kind` segue PARA — area, project, resource, archive — e Area non è un'entità separata.
_Avoid_: Area (come entità), cartella, workspace

**PARA**:
Convenzione che classifica gli Space in quattro `kind`: area, project, resource, archive. Non è una gerarchia parallela agli Space.
_Avoid_: Area come contenitore

**Capability**:
Unità di dominio che l'utente compone dentro uno Space: Tasks, Knowledge, Habits, Calendar. Non è un confine di codice.
_Avoid_: modulo, feature, plugin

**Extension**:
Capability che specializza un motore più ampio invece di definirne uno proprio: Languages per Learning, Romantic per Relationships.
_Avoid_: modulo, plugin

### Persone e accesso

**User**:
Principal di autenticazione. Esiste solo per l'accesso e non porta dati di dominio; il proprietario di Nando è implicito in ogni record.
_Avoid_: Person, account (come entità di dominio), utente (per le persone della vita)

**Person**:
Una persona reale del dominio, con identità stabile e indipendente dai contatti esterni. Il proprietario dell'app non è una Person.
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
Occorrenza registrata che prova che qualcosa è accaduto e può contribuire a uno score o a una cronologia. Nasce da un'azione manuale, da un task o da un evento di capability.
_Avoid_: completion, check, log

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

**EntityRef**:
Riferimento cross-module a un'entità: tipo + identificatore. Non è una foreign key e non implica una supertype comune.
_Avoid_: foreign key, puntatore

**Occurrence**:
Istanza datata di una definizione ricorrente, per esempio un task o un evento. Si completa o si salta individualmente.
_Avoid_: istanza, ricorrenza (come sinonimo)

**Completion**:
Fatto datato che un'Occurrence è stata completata. Non è uno stato della serie o della definizione che l'ha generata.
_Avoid_: status, check, done

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
- **Component / Service / Feature**: vocabolario tecnico generico, non specifico di Nando.
