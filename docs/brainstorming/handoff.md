# Personal OS — Documento di handoff progettuale

**Data di riferimento:** 26 ottobre 2026  
**Progetto di origine:** *Idee* → *Personal OS*  
**Destinatari:** agenti LLM incaricati di continuare discovery, product design, domain design, architettura e implementazione.  
**Tipo di documento:** sintesi dettagliata e strutturata delle conversazioni disponibili; **non** specifica di implementazione approvata.  
**Stato della roadmap ufficiale:** **NON MODIFICATA** durante gli approfondimenti di Habits, Learning e Relationships descritti qui.

> **Istruzione essenziale per agenti successivi:** preservare la distinzione tra **decisioni dell'utente confermate**, **consolidamento esplorativo**, **raccomandazioni dell'assistente**, **punti ancora aperti**. Non promuovere una proposta a requisito approvato senza una nuova conferma. Non modificare la roadmap ufficiale senza autorizzazione esplicita. Non confondere Personal OS con gli altri progetti dell'utente (per esempio Creuza o Folio).

---

## 0. Come leggere questo documento

### 0.1 Legenda degli stati

- **[C] Confermato dall'utente:** scelta o vincolo esplicito.
- **[E] Consolidato in esplorazione:** orientamento di design condiviso, utile come baseline ma non ancora congelato in specifica/roadmap.
- **[P] Proposta:** soluzione suggerita dall'assistente e non espressamente ratificata.
- **[A] Aperto:** decisione ancora da prendere o comportamento da specificare.
- **[X] Esclusione/vincolo:** un comportamento da non introdurre senza autorizzazione, o un limite concettuale già esplicitato.

Le informazioni di partenza derivano dalla conversazione corrente e dai resoconti recuperabili di discussioni pregresse. Alcuni aspetti della roadmap originaria e delle specifiche di altri moduli non erano disponibili in forma integrale: dove mancano dettagli sono riportati come **non ricostruiti**, anziché inventati.

### 0.2 Regole di continuità

1. Mantenere Personal OS come **applicazione personale modulare**, non come insieme di applicazioni indipendenti scollegate.
2. Preservare i confini di dominio fra capability comuni ed estensioni disciplinari.
3. Consentire sempre controllo, correzione e approvazione dell'utente sugli effetti significativi dell'AI.
4. Riutilizzare Tasks, Calendar, Knowledge, Habits e altre capability anziché duplicarle in ogni modulo.
5. Progettare privacy, provenienza, deduplicazione, idempotenza e storicizzazione come aspetti strutturali.
6. Distinguere l'esistenza di una **fonte di dati** dall'attendibilità di ogni **affermazione** o evento ricavato.
7. Nessun elemento di questo documento costituisce automaticamente aggiornamento della roadmap ufficiale.

---

# PARTE I — VISIONE GENERALE

## 1. Obiettivo di Personal OS

**[C/E]** Personal OS è una dashboard e un sistema operativo personale: uno spazio unificato per organizzazione, task, abitudini, apprendimento, conoscenza, relazioni e attività quotidiane. Deve unire moduli fortemente interoperabili con AI contestuale.

Elementi centrali:

- organizzazione flessibile di aree, progetti e risorse;
- dashboard personale con widget;
- Tasks e altre capability operative riutilizzabili;
- Knowledge Management articolato;
- Habits integrato con le azioni già eseguite nei moduli;
- Learning Engine che progetta e supervisiona percorsi di studio;
- Relationships Engine che aiuta a conoscere e coltivare relazioni personali;
- AI come assistente trasversale, non autorità che modifica arbitrariamente lo stato.

**[C]** L'applicazione nasce come progetto personale; la struttura dev'essere sufficientemente robusta da consentire approfondimenti e un'implementazione modulare. Non è stato definito qui un perimetro commerciale, una strategia di monetizzazione o una scala utenti.

## 2. Principi di prodotto

- **[C] Struttura PARA** (Projects, Areas, Resources, Archives) per l'organizzazione dell'informazione.
- **[C] Space componibili:** uno Space può combinare più capability invece di appartenere necessariamente a un modulo esclusivo.
- **[C] Dashboard con widget predefiniti**, configurabili e riordinabili.
- **[C] Knowledge completo** con backlink, proprietà e viste multiple.
- **[C] AI integrata e supervisionata:** suggerisce cambiamenti, che devono essere confermati prima dell'applicazione.
- **[C] Habits ibridi:** funzionano autonomamente oppure collegati a Tasks e altri moduli.
- **[C] CRM limitato alle relazioni personali:** non trasformare Personal OS in un CRM commerciale.
- **[E] Architettura modulare coerente:** domini indipendenti internamente, contratti condivisi e interoperabilità esplicita.
- **[P] Interfacce poco affollate:** priorità alle informazioni che richiedono attenzione, con dettagli in tab/sottosezioni.

## 3. Architettura di alto livello

**[C/E]** Direzione discussa: **modular monolith** in un **monorepo**, con moduli/capability e interfacce condivise.

```text
Personal OS
├── Shell / Navigation / Dashboard / Search
├── Organization (PARA / Spaces)
├── Shared capabilities
│   ├── Tasks
│   ├── Calendar
│   ├── Knowledge
│   ├── Habits
│   ├── Integration layer
│   └── AI orchestration / permissions
├── Learning Engine
│   └── Extensions (es. Languages)
└── Relationships Engine
    └── Extensions (Friendships, Family, Romantic, Professional)
```

Questa è una rappresentazione concettuale, **non** la definizione definitiva del repository. Non sono stati approvati per Personal OS uno specifico framework, ORM, DB, protocollo eventi o provider cloud.

### 3.1 Space e capability

**[C]** Un singolo Space può comporre più capability. Esempi concettuali:

- area *Salute*: Tasks + Habits + note;
- area *Lingue*: Learning + Tasks + Knowledge + Habits;
- progetto personale: Task + note + calendario;
- area *Relazioni*: Relationships + Tasks + Calendar + Habits.

**[A]** Restano da specificare autorizzazioni granulari, proprietà degli Space, schema dei riferimenti fra entità e contratto delle capability componibili.

### 3.2 AI comune

**[C]** L'AI assiste contestualmente; le modifiche strutturali richiedono approvazione. L'AI può suggerire associazioni, estrarre informazioni e costruire piani, ma non deve presumere che ogni inferenza sia un fatto.

**[P]** Architettura consigliata: strumenti tipizzati per interrogazione/proposta/applicazione; motivazione e provenienza dei suggerimenti; controllo esplicito prima di azioni persistenti; separazione fra generazione di candidature e loro esecuzione.

---

# PARTE II — CAPABILITY TRASVERSALI

## 4. Dashboard e navigazione

**[C]** Dashboard composta da **widget predefiniti**, configurabili e riordinabili.

**[A]** Da definire: catalogo widget, permessi/capability per widget, layout responsive, persistenza configurazioni, widget personali vs contestuali a Space, KPI e notifiche.

## 5. Tasks e Calendar

**[E]** Tasks e Calendar sono capability comuni alle quali altri moduli collegano attività ed eventi. Evitare task manager paralleli in Learning, Relationships o Habits.

Esempi:

- un task puntualissimo può contribuire a un Habit tramite un'associazione esplicita;
- un incontro da Calendar può fornire un segnale al Relationships Engine;
- un piano Learning può produrre attività o sessioni collegate a Tasks;
- un'occasione di Relationships può generare task (regalo, invito) e appuntamenti Calendar.

**[A]** Schema Tasks/Calendar, gestione ricorrenze, provider esterni, criteri dei trigger ed eventuali transazioni cross-module non sono definiti in dettaglio nei materiali ricostruiti.

## 6. Knowledge Management

**[C]** Knowledge è un modulo completo, non una semplice raccolta di note: backlink, proprietà, viste differenti, relazioni e organizzazione coerente con PARA.

**[E]** Gli altri moduli dovrebbero referenziare documenti Knowledge senza duplicare il relativo editor e storage.

- Habits può riferirsi a note/evidenze.
- Learning può usare materiali, letture, esercizi e fonti dentro Knowledge.
- Relationships collega note libere alle persone o alle interazioni.

**[A]** Editor, indicizzazione, modelli di property, filtri/vista, ACL, revisioni e motore di ricerca restano da progettare o recuperare da eventuali conversazioni non incluse.

---

# PARTE III — HABITS

## 7. Scopo e modello concettuale

**[C]** Habits deve poter gestire comportamenti ripetuti tramite completamento manuale o evidenze provenienti da Tasks e da capability di altri Space. Il collegamento a Tasks è **opzionale**.

Esempio canonico dell'utente:

> Habit: **“3 acts of love al mese”**. Creo il task puntuale **“compra fiori”** per il **28/10**. L'AI propone di collegarlo all'habit; l'utente conferma. Il task è fonte attiva finché può contribuire; completato, non deve più essere mostrato fra i trigger attivi ma deve restare come evidenza storica.

La distinzione fra regola persistente e contributo puntuale è fondamentale.

## 8. Decisioni Habits confermate

1. **[C] Habitat autonomi o collegati:** il collegamento a Tasks/altre capability non è obbligatorio.
2. **[C] Completamento manuale sempre disponibile.**
3. **[C] Trigger automatici solo da associazioni esplicite** con task puntuali, ricorrenti o eventi dichiarati da Space/capability. L'AI può suggerire l'associazione, **non attivarla da sola**.
4. **[C] Evidenze in uno storico unificato** per completamenti manuali e automatici.
5. **[C] Descrizione opzionale** anche sui completamenti manuali.
6. **[C] Fonti attive separate da evidenze storiche** e fonti inattive.
7. **[C] Un task monouso completato esce dalla lista dei trigger attivi**; il legame chiuso può restare nei dati tecnici/storici.
8. **[C] Lo stesso criterio vale per ricorrenze cancellate e azioni Space eliminate/disattivate**: non devono apparire come possibilità ancora attive.
9. **[C] Score individuale per Habit, aggregati per Area e score globale**; score globale come **media degli habit**, non semplicemente somma delle attività.
10. **[C] Periodi valutati binariamente**: obiettivo raggiunto oppure non raggiunto; progresso parziale mostrato **separatamente**.
11. **[C] Pause neutrali** per score e streak (non successi, non fallimenti).
12. **[C] Modifiche a target/frequenza/metrica/timezone** efficaci **dal periodo successivo**, senza riscrivere i risultati storici.
13. **[C] Promemoria individuali e riepiloghi disattivati di default**, attivabili dall'utente.
14. **[C/E] Deduplicazione per identità dell'attività**, non per semplice prossimità temporale.

## 9. Modello dati concettuale Habits

**[P]** Possibili entità:

```text
Habit
  ├── HabitGoalVersion[]           # target/versioni effective-from-period
  ├── HabitPeriod[]                # intervalli di valutazione
  ├── HabitSourceBinding[]         # fonti attive o chiuse
  ├── HabitEvidence[]              # storico unificato
  ├── HabitPause[]                 # pause neutrali
  └── HabitScoreSnapshot[]         # se necessario per storico/performance
```

- `HabitSourceBinding`: associazione a task, serie ricorrente, azione Space o evento dichiarato; lifecycle active/closed/disabled; provenance e timestamp.
- `HabitEvidence`: avvenimento che contribuisce a un periodo; provenienza `manual | task | capability_event`, descrizione opzionale, riferimento attività e chiave idempotente.
- `HabitPeriod`: target applicabile, evidenze conteggiate, progresso, stato binario, sospensione.
- `HabitGoalVersion`: storia dei cambi di configurazione con validità dal periodo futuro.

**[P]** È opportuno non confondere `binding closed` con cancellazione di `evidence`: chiudere un trigger non cancella ciò che l'utente ha già fatto.

## 10. Flusso dettagliato: task “compra fiori”

1. L'utente crea l'habit “3 acts of love al mese”.
2. Crea il task “compra fiori” il 28 ottobre.
3. AI/UX può suggerire il legame.
4. L'utente approva esplicitamente l'associazione.
5. Il task compare fra le **fonti attive** dell'habit.
6. Quando il task viene completato, viene prodotta una evidenza unica nello **storico dei completamenti**.
7. Il task monouso cessa di essere fonte attiva e il binding diventa inattivo/chiuso.
8. L'habit aggiorna il progresso del periodo corrente. La valutazione del periodo rimane binaria.
9. Se l'attività viene corretta/annullata, servono regole di rettifica che preservino audit e consistenza.

## 11. Casi limite Habits

**[A]** Da definire esplicitamente:

- Se task ed evento Space descrivono **la stessa azione**, come evitare il doppio conteggio (identità logica comune, event-id e correlazioni).
- Se un task completato viene riaperto, annullato o cancellato: revoca o rettifica dell'evidenza?
- Se una stessa evidenza contribuisce a due habit diversi: ammissibilità e regole di conteggio.
- Ricorrenze: differenza fra binding della serie e completamento di una sua occorrenza.
- Periodi con fusi orari differenti, cambio timezone, DST e periodi già conclusi.
- Pause iniziate o concluse a metà periodo e impatto sulla streak.
- Migrazione/archiviazione di Area e ripercussioni sullo score aggregato.
- Definizione esatta degli score e delle finestre temporali degli aggregati.
- Azioni manuali multiple nello stesso giorno: quando contano separatamente?
- Stato dei periodi in corso vs conclusi e modo di mostrare un progresso parziale senza spacciarlo per score definitivo.

---

# PARTE IV — LEARNING ENGINE

## 12. Obiettivo

**[C]** Trasformare la richiesta «voglio imparare X» in un piano personalizzato preparato dall'AI, che combina letture, esercizi, pratica, verifiche e risorse, adattandosi al livello e ai miglioramenti dell'utente.

**[C]** L'apprendimento delle lingue è una **estensione disciplinare** del Learning Engine, non un secondo motore scollegato.

## 13. Decisioni Learning confermate

1. **[C] AI-first con modifiche manuali:** l'AI propone/compone i percorsi, l'utente mantiene la possibilità di modificarli.
2. **[C] Learning Engine comune con estensioni disciplinari.**
3. **[C] Adattamento supervisionato:** le modifiche strutturali al percorso richiedono approvazione.
4. **[E] Percorso persistente e piano versionato**, non un insieme effimero di messaggi AI.
5. **[E] Evidenze di apprendimento distinte dalla stima di padronanza**; non basta completare una lezione per assumere che una skill sia acquisita.
6. **[E] AI come orchestratore di strumenti tipizzati**, con azioni proposte e applicate dopo conferma.
7. **[E] Materiali e fonti collegabili a Knowledge**, mantenendone provenienza/attribuzione.

## 14. Struttura concettuale

```text
Learning Path
  ├── Goal / Outcome
  ├── Learner Baseline
  ├── Versioned Plan
  │   ├── Milestones
  │   └── Learning Activities
  ├── Skill Graph
  │   ├── Prerequisites
  │   ├── Mastery Estimate
  │   └── Confidence
  ├── Sessions
  ├── Assessments
  └── Learning Evidence
```

**[P]** Le attività generiche (`read`, `practice`, `quiz`, `project`, `reflect`, ecc.) potrebbero essere specializzate tramite provider di disciplina; non fissare prematuramente enum esaustivi.

### 14.1 Ciclo del Learning Engine

1. Definizione del tema e del risultato desiderato.
2. Raccolta di livello, disponibilità, preferenze e vincoli.
3. Diagnosi iniziale/valutazione (se utile).
4. Produzione di una prima bozza di piano AI.
5. Approvazione e modifiche manuali.
6. Esecuzione sessioni e raccolta evidenze.
7. Valutazione del progresso e stime di mastery/confidenza.
8. Proposta AI di adattamento.
9. Approvazione delle modifiche strutturali; versionamento del piano.

### 14.2 Estensione Languages

**[E]** Languages riusa percorso, sessioni, skill, evidenze e piani del motore generale, ma introduce un vocabolario disciplinare proprio:

- livello di competenza e possibilmente CEFR;
- lessico e vocabolario in apprendimento;
- grammatica;
- letture graduate;
- flashcard / spaced repetition (SRS);
- scrittura con correzioni;
- pratica della conversazione;
- tutor contestuale che considera livello, errori e parole studiate.

Nelle discussioni precedenti lo **spagnolo** era citato come esempio iniziale; non significa che altre lingue siano escluse. Un evento come `study.session.completed` potrebbe contribuire a un habit **soltanto tramite un'associazione esplicita**.

## 15. Decisioni Learning ancora aperte

- **[A] Granularità del piano:** piano generale con dettaglio progressivo delle attività vs pianificazione interamente anticipata.
- **[A] Valutazione:** combinare verifiche AI, autovalutazione e evidenze pratiche; definire peso, attendibilità e feedback.
- **[A] Materiali:** proporzione e trattamento fra contenuti generati dall'AI, fonti esterne, materiali caricati e Knowledge.
- **[A] Regole di adattamento:** quali modifiche sono strutturali e richiedono approvazione? Quali aggiustamenti operativi sono consentiti?
- **[A] Skill graph:** rappresentazione, aggiornamenti, prerequisiti, conflitti fra valutazioni.
- **[A] Pianificazione e calendario:** rapporto con Tasks e Calendar, carico settimanale, sessioni saltate, riprogrammazione.
- **[A] Quality assurance:** controllo delle risorse esterne, fonti, errori fattuali e sicurezza dei contenuti AI.
- **[A] Estensibilità disciplinare:** API/contratti per provider, skill e assessment diversi.

---

# PARTE V — RELATIONSHIPS ENGINE

## 16. Visione del modulo

**[C]** Relationships è un **motore comune** per gestire relazioni personali con **estensioni specifiche**, non un semplice database di contatti o un CRM commerciale.

Principio centrale: aiutare l'utente a **ricordare le persone, riconoscere occasioni e coltivare relazioni significative**; non trasformare i legami in punteggi, classifiche o obblighi di produttività.

**[C]** L'utente ha confermato:

- motore comune con estensioni specifiche;
- acquisizione automatica di interazioni da servizi esterni **con consenso**;
- suggerimenti e promemoria AI contestuali;
- **acquisizione automatica dalle fonti attendibili** e **revisione delle altre**;
- informazioni ibride: **proprietà, memorie contestuali, note libere**;
- **suggerimenti flessibili** per mantenere contatti, anziché frequenze rigide.

L'intero design del modulo resta **esplorativo**, senza cambi alla roadmap.

## 17. Sei capability proposte

1. **People** — identità e profili.
2. **Connections** — relazioni multiple, contesti e gruppi.
3. **Interactions** — timeline, segnali importati ed evidenze di interazioni.
4. **Memories** — proprietà strutturate, memorie contestuali e note Knowledge.
5. **Occasions** — ricorrenze, eventi, iniziative, intenti.
6. **Intelligence** — suggerimenti AI, recupero contestuale e follow-up.

**[E/P]** Questa scomposizione è stata proposta come baseline funzionale, non come obbligo di pacchetti software specifici.

## 18. People: persona unica

**[E]** Una persona possiede un'identità interna unica e stabile e può avere molte relazioni, identità di servizi esterni, email, numeri di telefono, interessi, contesti, eventi e note.

```text
Person
├── ContactMethod[]
├── ExternalIdentity[]
├── RelationshipContext[]
├── GroupMembership[]
├── PersonFact[]
├── ContextualMemory[]
└── References to Tasks, Calendar, Knowledge, Interactions
```

La `Person` **non coincide** con il profilo Google Contacts, il contatto WhatsApp o un indirizzo email. Un contatto può cambiare numero, avere account multipli, condividerli o perdere accesso a essi.

**[P]** Merge prudente e confermato dall'utente; non unire persone solo perché hanno lo stesso nome.

## 19. Connections: relazioni multiple e estensioni

### 19.1 Domanda esplicita dell'utente

> «A una persona posso associare più tipologie (amici, romantici, ecc.) e da questo l'applicazione sa che tipo di consigli dare?»

**Risposta progettuale proposta:** **sì**. Una persona può avere più `RelationshipContext` attivi contemporaneamente, ad esempio *Friendship + Romantic + Professional*. La tipologia **abilita capability e candidati di suggerimento**, ma **non determina rigidamente** cosa l'AI può dire né autorizza automaticamente la lettura delle memorie private.

### 19.2 Distinzioni di dominio

- `Person`: chi è la persona.
- `Relationship` / `RelationshipContext`: in quale relazione e contesto si trova rispetto all'utente (o ad altri, quando esplicitamente registrato).
- `RelationshipType`: Friendship, Family, Romantic, Professional ecc.
- `Circle`: gruppo sociale organizzativo, per esempio «amici università».
- `GroupMembership`: appartenenza di persona al Circle.
- `ContextPreferences`: preferenze per i suggerimenti e per la visibilità.
- `ExtensionData`: campi specifici dell'estensione, se necessari.

**[P]** Non limitarsi a un `Person.types: string[]`: tale campo non cattura lifecycle, visibilità, note, priorità, preferenze e storico dei singoli contesti.

### 19.3 Estensioni come plugin di dominio interni

**[P]** Possibile contratto concettuale:

```typescript
interface RelationshipExtension {
  id: string;
  supportedContexts: string[];
  suggestionProviders: SuggestionProvider[];
  memorySchemas: MemorySchema[];
  occasionProviders: OccasionProvider[];
}
```

Estensioni considerate:

- `Friendships`: interessi e attività con amici, cerchie, occasioni comuni.
- `Family`: relazioni e ricorrenze familiari.
- `Romantic`: relazioni sentimentali, ricorrenze e memorie intime/private.
- `Professional`: networking e collaborazioni, pur restando nell'area personale e non nel CRM commerciale.

Non è stato deciso di implementarle tutte da subito. **Romantic** è distinto e con isolamento logico di dati specifici; accessi cross-context devono essere controllati.

### 19.4 Esempio di persona con contesti multipli

```text
Giulia: Person #123
  - Friendship / active
  - Romantic / active / private
  - Professional / active

Memorie:
  - «È vegetariana» → General
  - «Ama il trekking» → General o Friendship
  - «Anniversario della coppia 15/06» → Romantic
  - «Lavora al progetto X» → Professional
  - «Nota intima privata» → Romantic / sensitive
```

**[P]** La memoria può appartenere a uno o più scope, ma nessuna estensione ottiene accesso implicito a tutti gli scope solo per la presenza del relativo tag. Serve autorizzazione sia a livello di contesto sia di uso previsto.

## 20. Interactions e Imported Signals

**[C]** Acquisizione automatica quando la fonte è configurata attendibile; altrimenti revisione. Sempre previo consenso all'integrazione.

**[E]** Separare `ImportedSignal` (dato ricevuto) da `Interaction` (evento interpretato/registrato). La mera esistenza in calendario di una cena non prova che l'incontro sia realmente avvenuto.

```text
External service
  -> Connector
  -> Normalization
  -> External identity matching
  -> Deduplication
  -> Trust/consent rules
  -> ImportedSignal
  -> Candidate Interaction
  -> Auto-register OR Review Queue
  -> Timeline
```

Possibili stati:

- `ImportedSignal`: acquired, processed, duplicate, ignored, deleted/expired.
- `Interaction`: proposed, confirmed, rejected/cancelled (da definire nel dettaglio).
- Provenienza: manual, calendar, email, messaging, task, ecc.

**[P]** Trust per connector **e per tipologia di evento**, non un singolo booleano globale. «Fonte attendibile» non equivale a «ogni evento è avvenuto». Una sincronizzazione può registrare automaticamente un evento pianificato, mentre la conferma della partecipazione può restare separata.

### 20.1 Import idempotente

**[P]** Requisiti tecnici raccomandati:

- external IDs e mapping stabili;
- deduplica fra importazioni successive e fra fonti;
- cursori incrementali quando supportati;
- provenance delle modifiche;
- riconciliazione update/cancellazioni;
- revoca connector senza perdita indiscriminata di dati creati manualmente;
- policy configurabili per eliminare dati importati alla disconnessione.

## 21. Memories: modello ibrido

**[C]** Tre strati coesistenti:

1. **Proprietà strutturate:** data di nascita, città, interessi classificati, preferenze relativamente stabili.
2. **Memorie contestuali:** «sta cercando casa», «ha iniziato un corso», «vorrebbe vedere una mostra»; fonte, data, validità e stato.
3. **Note libere:** testi che rimangono nel Knowledge Management e si collegano a persona, interazione o contesto.

**[P]** Stati possibili delle memorie: attiva, superata, contestata, archiviata. Livelli di sensibilità e policy di retrieval. Estrazione AI sempre trattata come proposta o informazione con livello di attendibilità, non automaticamente fatto verificato.

**[E]** Evitare di copiare il contenuto di Knowledge in un secondo archivio note del modulo Relationships.

## 22. Occasions e iniziative

Esempi:

- compleanni e anniversari;
- idee regalo;
- attività da organizzare insieme;
- promessa di risentire qualcuno;
- incontro pianificato;
- proposta di un viaggio o di una cena.

**[E]** Relationship Occasions può fungere da entità leggera di contesto; gli impegni operativi sono Tasks e gli appuntamenti Calendar. Evitare un secondo task manager.

## 23. Relationship Intelligence e proattività

**[C]** L'AI deve fornire **suggerimenti flessibili e promemoria contestuali**, non imporre quote di contatti o classifiche di amicizie.

Quattro input concettuali proposti:

1. relazione/contesto attivo;
2. memorie e fatti autorizzati;
3. situazione (occasioni, eventi, promesse, attività);
4. preferenze personali e di suggerimento.

Flusso proposto:

```text
Person + active contexts
  -> select relevant extensions
  -> retrieve permitted memories
  -> candidate suggestions per extension
  -> cross-extension dedup + ranking + privacy filter
  -> present suggestion with explanation/source
  -> user accepts / dismisses / snoozes
  -> optional Task / Calendar action after approval
```

**[P]** State machine delle proposte: `Proposed -> Seen -> Accepted | Dismissed | Snoozed`. Usare chiavi semantiche e history dei dismiss per non riproporre sempre la stessa idea.

**[X/E]** Evitare scoring della “qualità dell'amicizia”, deduzioni psicologiche automatiche, classifiche tra persone e frequenze obbligatorie.

### 23.1 Policy privacy

**[E/P]** Non basta disattivare un'estensione nella UI: il retrieval per l'AI deve applicare realmente scope, sensitività, contesto, provenienza, concessione e finalità. In particolare `Romantic` non deve contaminare suggerimenti `Professional` o `Friendship`.

## 24. Integrazioni e fonti

Fonti discusse (fattibilità e permessi vanno verificati per provider/versione):

| Fonte | Impiego concettuale | Attenzione |
|---|---|---|
| Google Contacts / rubriche | Importazione contatti e identità | Merge, revoca, aggiornamento |
| Google Calendar / Outlook | Incontri, invitati, ricorrenze | Programmato ≠ avvenuto |
| Email | Segnali di interazione, follow-up | Elevata sensibilità e volume |
| Messaggistica | Conversazioni e memoria contestuale | API, privacy, termini, completezza |
| Foto/album | Ricordi condivisi | Identificazione delle persone, consenso |
| Tasks/Calendar interni | Iniziative e interazioni collegate | Idempotenza e stato |

**[P]** Metadata-first dove possibile; minimizzare importazione integrale di email/conversazioni.

---

# PARTE VI — WHATSAPP E CONTEXT EXTRACTION

## 25. Obiettivo espresso dall'utente

> «È possibile associare ad una persona il numero di telefono e periodicamente leggere la mia conversazione su WhatsApp con questo numero ed estrarre possibili informazioni di contesto?»

Il valore desiderato è una **memoria relazionale semiautomatica**: riconoscere interessi, preferenze, aggiornamenti di vita, inviti, promesse e attività da pianificare senza dover annotare tutto a mano.

## 26. Risposta di fattibilità discussa

**[E]** Si può associare un numero a una `Person` e analizzare una chat WhatsApp **esportata**. Non c'è però una normale API ufficiale per leggere periodicamente e liberamente tutta la cronologia dell'account WhatsApp personale di un utente terzo rispetto all'infrastruttura WhatsApp.

Opzioni emerse:

1. **Esportazione manuale chat**: affidabile per una prima versione; file acquisito da Personal OS, analisi e approvazione delle memorie.
2. **Condivisione selettiva di messaggi**: l'utente invia estratti mirati a Personal OS.
3. **Automazione WhatsApp Web non ufficiale** (`whatsapp-web.js`, Baileys o simili): tecnicamente esplorabile, ma fragile, esposta a modifiche del protocollo, rischi per account/sicurezza e termini d'uso; disponibilità dello storico non garantita.
4. **Notification Listener Android**: osservazione incompleta di parte dei messaggi notificati, non un archivio affidabile (chat silenziate, contenuti nascosti, media, cronologia ecc.).
5. **WhatsApp Business Platform**: per scenari business, non soluzione generale di lettura delle chat personali esistenti.

**[P] Raccomandazione dell'assistente, non decisione ratificata:** partire da importazione/esportazione manuale e progettare un contratto per connector futuri senza dipendere da client non ufficiali.

**Nota di cautela:** disponibilità delle API, termini e funzionalità di provider cambiano; prima di implementare verificare la documentazione ufficiale corrente. Non interpretare questa sezione come autorizzazione a usare metodi di acquisizione non conformi.

## 27. Context Extraction come capability cross-source

**[P]** La logica di estrazione non dovrebbe dipendere da WhatsApp. Una singola pipeline dovrebbe poter ricevere:

- conversazioni esportate;
- messaggi condivisi selettivamente;
- email autorizzate;
- note Knowledge;
- resoconti di incontri;
- altri eventi contestuali.

```text
Content source
  -> consent / processing-policy check
  -> import + normalization
  -> identify participants / Person mapping
  -> incremental deduplication
  -> AI extraction (bounded by permissions)
  -> candidate facts / memories / tasks / occasions
  -> user review + source explanation
  -> approved persistence in Relationships/Tasks/Calendar/Knowledge
```

### 27.1 Esempio canonico

Conversazione ipotetica:

```text
Giulia: Ho iniziato un corso di fotografia!
        Mi piacerebbe visitare quella mostra a Milano il mese prossimo.
Io:     Ottima idea, organizziamo un sabato.
```

Possibili estrazioni **da revisionare**:

- memoria: Giulia ha iniziato un corso di fotografia;
- interesse/intenzione: le interessa una mostra a Milano;
- possibile iniziativa: organizzare una visita insieme;
- possibile task: verificare date e disponibilità della mostra.

Il sistema deve distinguere chiaramente **desiderio**, **intenzione**, **promessa**, **impegno confermato**, **fatto** e **inferenza**. «Potremmo andare» non significa «abbiamo prenotato».

### 27.2 Conservazione dei dati

**[P]** Conversazione come fonte temporanea di informazioni; preferire la conservazione delle memorie/azioni approvate anziché un archivio permanente integrale delle chat.

Ciò implica però una tensione da risolvere: mantenere la provenienza per audit e correzione senza accumulare testo di conversazioni private. Possibili strategie da valutare: riferimento alla fonte originale, estratto minimo cifrato con retention breve, impronta/hash del messaggio e timestamp, import batch con lifecycle e cancellazione.

### 27.3 Consenso e trattamento AI

**[P]** Distinguere tre autorizzazioni:

1. accesso/importazione;
2. elaborazione con AI, incluso eventuale invio a provider esterno;
3. conservazione dei risultati e loro utilizzo per suggerimenti futuri.

La persona cui si riferiscono i messaggi è un terzo: la progettazione deve considerare sua riservatezza, sensibilità dei contenuti, aspettative di confidenzialità, sicurezza e requisiti normativi applicabili. Per informazioni particolarmente sensibili, limitare l'elaborazione e valutare processamento locale, minimizzazione e review prima della persistenza.

## 28. Numero WhatsApp ≠ identità certa

**[P]** Numero di telefono come `ContactMethod`/`ExternalIdentity`, non primary key della `Person`:

- un numero può essere riassegnato;
- una persona può usare più numeri;
- lo stesso numero può essere usato da più persone in differenti periodi/contesti;
- un display name o nickname non prova l'identità;
- le chat di gruppo hanno partecipanti multipli.

Il matching deve mostrare motivazione e grado di certezza, ed essere correggibile. Se incerto, richiedere conferma prima di associare contenuti sensibili alla persona sbagliata.

---

# PARTE VII — ARCHITETTURA RELATIONSHIPS PROPOSTA

## 29. Confini software

**[P]** Strutturazione concettuale in quattro componenti logiche:

```text
relationships-core
  - People
  - Connections
  - Interactions
  - Memories
  - Occasions

relationships-extensions
  - friendship
  - family
  - romantic
  - professional

integration-adapters
  - imports / connectors
  - normalization
  - identity matching
  - incremental sync

relationship-intelligence
  - context extraction
  - suggestion generation
  - privacy-aware retrieval
  - candidate ranking / lifecycle
```

Non serve convertirli in microservizi. Possono essere moduli in un modular monolith, con contratti chiari.

## 30. Possibili entità e relazioni (bozza)

```text
Person
  id
  names / nickname / photo
  contact_methods[]
  external_identities[]

RelationshipContext
  id, person_id, type, status
  visibility, preferences, extension_data

Circle
  id, name
GroupMembership
  circle_id, person_id, role?

ImportedSignal
  id, provider, provider_event_id, timestamps
  raw_ref?, normalized_payload, ingestion_status
  processing_policy, provenance

Interaction
  id, type, happened_at?, status
  participants[], sources[], notes_ref[]

PersonFact
  id, person_id, attribute, value
  source, validity, sensitivity, confidence

ContextualMemory
  id, subject_refs[], statement
  scope[], source, valid_from/to?, status
  sensitivity, confidence, provenance

Occasion
  id, kind, recurrence?, participants[]
  calendar_ref?, related_initiatives[]

RelationshipSuggestion
  id, kind, explanation, source_refs[]
  target_persons[], scope[], state
  semantic_dedupe_key, proposed_action
```

Sono **nomi indicativi**, non un contratto SQL/API approvato. Evitare `Record<string, unknown>` indiscriminati nei punti che richiedono tipizzazione stabile; si può consentire estensibilità con schemi versionati per estensione.

## 31. Casi limite Relationships da presidiare

| Caso | Direzione discussa/proposta |
|---|---|
| Persone duplicate | Merge esplicito e preferibilmente reversibile |
| Omonimi | Non unire solo sulla base del nome |
| Cambio numero telefono | Conservare identity mapping/versioning |
| Evento Calendar cancellato | Riconciliare senza cancellare note manuali |
| Incontro pianificato ma mai avvenuto | Non considerarlo automaticamente confermato |
| Memoria obsoleta | Stato/supersessione, non riscrivere silenziosamente lo storico |
| Fonti in conflitto | Priorità per origine + review |
| Revoca connector | Fermare sync, offrire controllo sui dati importati |
| Cancellazione Persona | Gestire riferimenti condivisi e retention |
| Suggerimento AI inopportuno | Dismiss persistente, filtri per categoria/persona |
| Relazione cambia natura | Conservare storia e scope appropriati |
| Persona esclusa dai reminder | Nessun suggerimento di contatto relativo a quella persona |
| Romantic e Professional coesistenti | Privacy context-aware e no leakage |
| Doppio segnale da Calendar/email | Una interazione, molte fonti |
| Chat di gruppo | Attribuzione per mittente e consenso/policy appropriate |
| Inferenza AI errata | Correzione, tracciamento provenienza e invalidazione derivati |

## 32. Interfaccia Relationships

**[P]** Quattro viste leggere:

- **Overview:** occasioni vicine, follow-up e suggerimenti selezionati;
- **Persone:** rubrica, cerchie e profili;
- **Attività:** interazioni passate, proposte da revisionare;
- **Occasioni:** ricorrenze e iniziative programmate.

Profilo persona: identità e informazioni generali, tab/sezioni per contesti, timeline, memorie, collegamenti a Knowledge/Tasks/Calendar; dettagli privati mostrati soltanto nella modalità autorizzata.

L'Overview non deve diventare una dashboard di statistiche sociali: mostra ciò che merita attenzione, non una classifica delle relazioni.

---

# PARTE VIII — DECISION REGISTER

## 33. Registro sintetico delle decisioni

| ID | Area | Stato | Decisione |
|---|---|---|---|
| POS-001 | Architettura | C/E | Modular monolith, monorepo e confini/moduli condivisi |
| POS-002 | Organizzazione | C | PARA e Space con capability componibili |
| POS-003 | Dashboard | C | Widget predefiniti, configurabili e riordinabili |
| POS-004 | Knowledge | C | Modulo completo con backlink, proprietà e viste |
| POS-005 | AI | C | Suggerimenti e approvazione prima delle modifiche |
| POS-006 | Relationships scope | C | CRM soltanto relazioni personali |
| HAB-001 | Habits | C | Autonomi o collegati opzionalmente a task/altri moduli |
| HAB-002 | Trigger | C | Associazioni esplicite; AI non abilita da sola |
| HAB-003 | Storico | C | Evidenze manuali/automatiche unificate; descrizione manuale opzionale |
| HAB-004 | Trigger attivi | C | Fonti attive separate da chiuse e storico evidenze |
| HAB-005 | Score | C | Score per habit/Area/globale; globale media degli habit |
| HAB-006 | Periodi | C | Valutazione binaria; progresso parziale separato |
| HAB-007 | Pause | C | Neutrali per score e streak |
| HAB-008 | Obiettivi | C | Modifiche dal periodo successivo, no riscrittura storico |
| HAB-009 | Reminder | C | Individuali/riepiloghi opt-in (off default) |
| HAB-010 | Dedup | C/E | Identità attività invece della mera prossimità |
| LEA-001 | Learning | C | AI-first con modifiche manuali |
| LEA-002 | Learning | C | Engine comune + estensioni disciplinari |
| LEA-003 | Adattamento | C | Strutturale supervisionato/approvato |
| REL-001 | Relationships | C | Motore comune + estensioni |
| REL-002 | Acquisizione | C | Automatico da fonti attendibili; review altre |
| REL-003 | Informazioni | C | Proprietà + memorie contestuali + note |
| REL-004 | AI | C | Suggerimenti/promemoria contestuali, flessibili |
| REL-005 | Integrazioni | C | Acquisizione esterna solo con consenso |
| REL-006 | Romantic | E | Estensione privata distinta, isolation di scope |
| REL-007 | Identità | E/P | Persona unica con relazioni multiple |
| REL-008 | ImportedSignal | E/P | Separato da Interaction confermata |
| REL-009 | Suggestion Engine | P | Provider per estensioni + ranking centrale |
| REL-010 | WhatsApp | P | Import chat manuale iniziale, connector eventuali |
| REL-011 | Context Extraction | P | Pipeline generale indipendente dalla fonte |
| POS-ROADMAP | Roadmap | C/X | Nessun aggiornamento autorizzato in queste discussioni |

**Attenzione:** `C/E` significa direzione riferita e condivisa ma non necessariamente tutti i dettagli implementativi approvati. `E/P` significa che la semantica è stata discussa, mentre modellazione e formalizzazione restano suggerimenti.

---

# PARTE IX — QUESTIONI APERTE, RISCHI E PROSSIMI PASSI

## 34. Questioni trasversali

1. **[A] Roadmap ufficiale:** recuperare documento completo prima di assegnare versioni o spostare funzionalità. La roadmap è rimasta invariata.
2. **[A] Modello di permessi:** dati comuni vs contenuti privati per estensione/Space; policy per AI e provider.
3. **[A] Framework e stack tecnologico:** nessuna selezione definitiva ricostruita per Personal OS.
4. **[A] Contratti intermodulo:** eventi, command/query, schema references, idempotenza.
5. **[A] Versionamento:** piani Learning, obiettivi Habits, facts/memories Relationships.
6. **[A] Search e AI retrieval:** risultati con provenance, ACL e spiegazione.
7. **[A] Esperienza mobile/offline:** non definita qui.
8. **[A] Retention/cancellazione:** soprattutto per importazioni relazionali e dati terzi.
9. **[A] Reporting e notifiche:** preferenze, priorità e prevenzione notification fatigue.
10. **[A] Confini fra Tasks, Calendar, Habits, Learning, Relationships e Knowledge** quando una stessa azione interessa più moduli.

## 35. Approfondimenti consigliati, senza alterare roadmap

### 35.1 Habits

- specificare schema Event/Evidence/Binding e invarianti di conteggio;
- definire algoritmo score/streak e pause su periodi parziali;
- definire rettifiche per completamenti riaperti/cancellati;
- prototipare UI *fonti attive / storico completamenti / periodo*.

### 35.2 Learning

- decidere progressività e versioning del piano;
- definire framework di assessment e mastery;
- precisare materiali esterni vs AI generativi, provenance;
- definire API delle estensioni e primo caso Languages;
- distinguere modifiche strutturali e micro-adattamenti.

### 35.3 Relationships

- confermare o modificare il contratto `RelationshipContext` multivalore;
- progettare scope delle memorie e permission check prima del retrieval;
- specificare trust model per `ImportedSignal` e `Interaction`;
- definire suggerimenti, dedupe semantica e dismiss persistente;
- decidere retention del contenuto chat e provenance minima;
- testare importazioni incrementali e dedup di export successivi;
- precisare privacy/consenso su dati di terzi.

## 36. Cosa NON fare in automatico

- **Non** modificare la roadmap ufficiale senza comando esplicito.
- **Non** presentare come già scelte per Personal OS librerie usate o discusse per altri progetti.
- **Non** convertire i suggerimenti AI in azioni persistenti senza il controllo richiesto.
- **Non** creare un task manager dentro Relationships o Learning.
- **Non** attribuire automaticamente un'interazione avvenuta a un evento soltanto pianificato.
- **Non** conteggiare due volte un'azione Habits solo perché è visibile in due fonti.
- **Non** lasciare trigger monouso completati fra le fonti attive.
- **Non** trasformare una memoria AI estratta in un fatto garantito.
- **Non** permettere che Romantic diventi leggibile da altri contesti per il solo fatto che la persona è la stessa.
- **Non** costruire un requisito core attorno a scraping WhatsApp non ufficiale.
- **Non** confondere relazione multipla con condivisione automatica di tutti i dati della persona.

## 37. Possibile sequenza per un agente successivo

1. Leggere il registro decisioni e indicare esplicitamente quali sezioni intende approfondire.
2. Recuperare, se disponibile, la **roadmap ufficiale**; non ricostruirla arbitrariamente.
3. Definire separatamente **requisiti**, **invarianti di dominio**, **stati**, **flussi** e **bozze tecniche**.
4. Per ogni scelta nuova, presentare alternative e trade-off; chiedere conferma solo delle scelte di prodotto/architettura davvero rilevanti.
5. Mantenere traccia delle modifiche autorizzate e delle decisioni rimaste esplorative.
6. Se richiesto un output implementativo, partire da capability core e contratti condivisi, non dai connector più fragili.

---

# APPENDICE A — Esempi di user story

Queste storie sintetizzano comportamenti desiderati; la loro priorità di rilascio non è approvata.

### A.1 Habits

- Come utente, voglio definire «3 acts of love al mese» e segnare manualmente una buona azione con descrizione facoltativa.
- Come utente, voglio associare esplicitamente il task «compra fiori» all'habit, così che il completamento generi una sola evidenza.
- Come utente, dopo aver completato quel task puntuale, non voglio più vederlo fra i trigger attivi, ma voglio ritrovarlo nello storico.
- Come utente, se metto in pausa un habit, non voglio perdere la streak per i periodi sospesi.
- Come utente, se cambio il target, voglio che il passato rimanga valutato usando il target valido all'epoca.

### A.2 Learning

- Come utente, voglio descrivere un argomento, il mio livello e la disponibilità settimanale per ottenere un piano AI modificabile.
- Come utente, voglio che l'AI proponga revisioni del piano quando emergono progressi o difficoltà, senza applicare modifiche strutturali non approvate.
- Come utente, voglio vedere perché una skill è considerata acquisita, distinguendo esercizi completati da vera evidenza di apprendimento.
- Come utente, voglio studiare una lingua con lessico, grammatica, writing, ripasso SRS e tutor contestuale sul medesimo Learning Engine.

### A.3 Relationships

- Come utente, voglio classificare Giulia sia come amica sia come partner, senza duplicare il suo profilo.
- Come utente, voglio che i suggerimenti Romantic usino soltanto memorie ammesse in quel contesto.
- Come utente, voglio importare un evento di Calendar e decidere se abbia rappresentato un incontro avvenuto.
- Come utente, voglio collegare con consenso una fonte attendibile e acquisire automaticamente i segnali previsti, mentre gli altri passano in review.
- Come utente, voglio registrare che un amico ha iniziato un corso, con fonte e data, senza trasformarlo in una proprietà eterna.
- Come utente, voglio ignorare un suggerimento senza vederlo riproposto identico a ogni analisi.
- Come utente, voglio importare un export WhatsApp e ricevere proposte di memorie o task da approvare, evitando di dover conservare tutta la chat per sempre.

---

# APPENDICE B — Criteri di qualità per ulteriori agenti

Prima di presentare nuove proposte, verificare:

- **Fidelity:** ogni affermazione marcata confermata discende da una scelta esplicita?
- **Roadmap integrity:** è invariata salvo autorizzazione?
- **Domain integrity:** eventi, evidenze, fonti e interazioni sono entità distinte quando serve?
- **Privacy:** retrieval AI e cross-extension sono filtrati per scope e autorizzazioni?
- **Auditability:** le modifiche AI/importate sono reversibili o almeno rintracciabili?
- **Interoperability:** le capability riusano Tasks, Calendar e Knowledge invece di duplicarli?
- **User agency:** l'utente può disabilitare, correggere, eliminare, ignorare e approvare?
- **AI calibration:** differenza fra fatti, inferenze, desideri, intenzioni e impegni preservata?
- **Graceful degradation:** l'app funziona anche senza provider AI, connector o chat imports?
- **Non-gamification:** le persone non sono trattate come punteggi di relazione?

---

# APPENDICE C — Snapshot dello stato al 26/10/2026

| Modulo/area | Stato progettuale |
|---|---|
| Visione/organizzazione Personal OS | Direzione definita, dettagli implementativi aperti |
| Dashboard | Scelte base confermate; catalogo UX da dettagliare |
| PARA/Spaces | Composizione capability confermata |
| Knowledge | Perimetro evoluto confermato; schema non finalizzato |
| Tasks/Calendar | Capability condivise; specifica completa non ricostruita |
| Habits | Decisioni funzionali ricche e consolidate esplorativamente; metriche/edge-case ancora aperti |
| Learning | AI-first, engine+extensions, adattamento supervisionato confermati; pianificazione/assessment/materiali aperti |
| Relationships | Sei capability proposte; principali scelte funzionali confermate, modello tecnico da validare |
| Relationship extensions | Multi-context e provider di suggerimenti proposti; privacy/scope da formalizzare |
| WhatsApp import | Fattibilità discussa; import manuale iniziale raccomandato ma non approvato |
| AI cross-module | Approvazione modifiche confermata; contratti/permessi da dettagliare |
| Roadmap ufficiale | **Invariata** |

**Fine del documento.**
