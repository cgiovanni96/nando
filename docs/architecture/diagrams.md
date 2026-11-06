# Diagrammi di Nando

> **Stato:** bozza di lavoro, generata dagli ADR 0001–0018 il 2026-10-29 e aggiornata con ADR-0022 il 2026-11-06.
> La fonte di verità resta `docs/adr/`. Se una decisione cambia, il diagramma va rigenerato o cancellato: un diagramma vecchio è peggio di nessun diagramma.

Indice:

1. [Livelli e dipendenze](#1-livelli-e-dipendenze)
2. [Topologia di deploy](#2-topologia-di-deploy)
3. [Richiesta HTTP e streaming](#3-richiesta-http-e-streaming)
4. [Workspace e confini](#4-workspace-e-confini)
5. [Modello dati: kernel e core](#5-modello-dati-kernel-e-core)
6. [Modello dati: Tasks e Calendar](#6-modello-dati-tasks-e-calendar)
7. [Modello dati: Knowledge](#7-modello-dati-knowledge)
8. [Modello dati: Habits](#8-modello-dati-habits)
9. [Modello dati: AI e policy](#9-modello-dati-ai-e-policy)
10. [Macchine a stati](#10-macchine-a-stati)
11. [Flusso: completare un task](#11-flusso-completare-un-task)
12. [Flusso: check-in manuale e dedup](#12-flusso-check-in-manuale-e-dedup)
13. [Flusso: scrivere un documento](#13-flusso-scrivere-un-documento)
14. [Flusso: ricerca e retrieval](#14-flusso-ricerca-e-retrieval)
15. [Flusso: proposta AI](#15-flusso-proposta-ai)
16. [Ciclo di vita: deletion, purge, retention](#16-ciclo-di-vita-deletion-purge-retention)
17. [Backup, restore, export](#17-backup-restore-export)
18. [Accesso e autenticazione](#18-accesso-e-autenticazione)
19. [Ticket aperti e roadmap](#19-ticket-aperti-e-roadmap)

---

## 1. Livelli e dipendenze

ADR-0005. Il core non conosce le capability; le capability usano il core tramite porte; la piattaforma è sostituibile.

```mermaid
flowchart TB
    subgraph CORE["Core — sempre disponibile"]
        SP["Space / PARA"]
        TK["Task / Calendar"]
        NT["Notification"]
        PR["Person minima"]
    end

    subgraph CAP["Capability — opzionale per Space"]
        KN["Knowledge"]
        HB["Habits"]
        LR["Learning (mappa separata)"]
        RL["Relationships (mappa separata)"]
    end

    subgraph PLAT["Piattaforma — servizi tecnici"]
        AU["Auth / Access"]
        ST["Storage S3"]
        EM["Email"]
        AI["AI orchestration"]
        DB["Postgres"]
        JB["Job pg-boss"]
    end

    CAP -->|"usa porte, comandi, eventi"| CORE
    CAP --> DB
    CORE --> DB
    PLAT --> DB
    CORE -.->|"vietato"| CAP
    CAP -.->|"vietato"| CAP
```

---

## 2. Topologia di deploy

ADR-0009, ADR-0010, ADR-0012.

```mermaid
flowchart TB
    subgraph CLIENT["Client"]
        BR["Browser desktop"]
        MB["Chrome Android / PWA"]
    end

    subgraph CF["Cloudflare"]
        ACC["Access: IdP + MFA"]
        TUN["Tunnel"]
    end

    subgraph VPS["VPS — Ubuntu, 6 vCPU, 24 GB"]
        subgraph PROD["Produzione"]
            WP["web :3001"]
            AP["api (nessuna porta pubblica)"]
            WK["worker"]
            MG["migrate one-shot"]
            PG[("Postgres 17 + pgvector")]
        end
        subgraph STG["Staging — solo tailnet"]
            SW["web :3002"]
            SA["api staging"]
            SWK["worker staging"]
            SPG[("Postgres staging")]
        end
        DOK["Dokploy — deploy e start/stop staging"]
    end

    subgraph EXT["Esterni"]
        R2[("R2: assets, backups, exports")]
        RS["Resend"]
        LLM["Provider AI"]
    end

    BR --> ACC --> TUN --> WP
    MB --> ACC
    WP -->|"bearer token interno"| AP
    AP --> PG
    WK --> PG
    MG --> PG
    WP -->|"SSE relay"| AP
    WK --> RS
    AP --> LLM
    AP --> R2
    SW --> SA --> SPG
    DOK --> STG
    AP --> R2
```

---

## 3. Richiesta HTTP e streaming

ADR-0010, ADR-0012, ADR-0016, ADR-0022. Un solo origin per il browser; l'API non è raggiungibile dall'esterno.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant A as Cloudflare Access
    participant W as web
    participant P as api
    participant D as Postgres

    B->>A: GET nando.giovannicosta.me
    A->>A: sessione Access valida?
    A-->>B: redirect al login se assente
    A->>W: richiesta autenticata
    W->>W: SSR con TanStack Start
    W->>P: proxy /api/*, Authorization bearer
    P->>D: query con scope applicativo
    D-->>P: righe
    P-->>W: JSON
    W-->>B: HTML + hydration

    Note over B,W: browser usa /api/*; SSR chiama api direttamente

    Note over B,W: streaming
    B->>W: GET /events (SSE)
    W->>P: stream SSE interno
    P-->>W: eventi
    W-->>B: relay senza buffering

    Note over W,P: /api/reference e /api/openapi.json passano dallo stesso proxy
```

---

## 4. Workspace e confini

ADR-0010. Otto workspace; il grafo dei pacchetti è il vincolo architetturale.

```mermaid
flowchart LR
    subgraph APPS["apps"]
        WEB["web"]
        API["api"]
        WRK["worker"]
    end

    subgraph PKGS["packages"]
        KER["kernel"]
        COR["core"]
        PLT["platform"]
        CK["capability-knowledge"]
        CH["capability-habits"]
    end

    WEB --> API
    WEB -.->|"solo tipi RPC"| API
    API --> COR
    API --> CK
    API --> CH
    API --> PLT
    WRK --> COR
    WRK --> CK
    WRK --> CH
    WRK --> PLT
    COR --> KER
    CK --> KER
    CH --> KER
    CK --> PLT
    CH --> PLT
    COR -.->|"vietato"| CK
    COR -.->|"vietato"| CH
    CK -.->|"vietato"| CH
```

---

## 5. Modello dati: kernel e core

ADR-0001, ADR-0002, ADR-0003, ADR-0017. `EntityRef` è un valore, non una tabella.

```mermaid
erDiagram
    SPACE ||--o{ SPACE : "parent di"
    SPACE ||--o{ SPACE_CAPABILITY : attiva
    SPACE ||--o{ PROPERTY_DEFINITION : definisce
    SPACE ||--o{ TASK : contiene
    SPACE ||--o{ DOC : contiene

    PROPERTY_DEFINITION ||--o{ PROPERTY_VALUE : istanziata

    SPACE {
        uuid id PK
        uuid parentId FK
        text kind
        text name
        text state
        timestamptz deletedAt
    }
    SPACE_CAPABILITY {
        uuid spaceId FK
        text capabilityKey
        text state
        jsonb config
    }
    PROPERTY_DEFINITION {
        uuid id PK
        uuid spaceId FK
        text key
        text type
        text format
        text appliesTo
        timestamptz deletedAt
    }
    PROPERTY_VALUE {
        uuid id PK
        text entityType
        uuid entityId
        uuid definitionId FK
        text valueText
        numeric valueNumber
        timestamptz valueDate
        timestamptz valueDateEnd
        boolean valueBool
        jsonb provenance
    }
    ENTITY_REF_VALUE {
        text type
        uuid id
    }
    TOMBSTONE {
        text type
        uuid id
        timestamptz deletedAt
    }
    OUTBOX {
        uuid eventId PK
        text type
        text aggregateType
        uuid aggregateId
        jsonb payload
        text status
        int attempts
    }
    IDEMPOTENCY {
        uuid actorId
        text commandName
        text key
        jsonb result
        timestamptz expiresAt
    }
    RECTIFICATION {
        uuid id PK
        text targetType
        uuid targetId
        text action
        text reason
        jsonb provenance
    }
    LINK {
        uuid id PK
        text fromType
        uuid fromId
        text toType
        uuid toId
        uuid activityId
    }
```

---

## 6. Modello dati: Tasks e Calendar

ADR-0004, ADR-0006. Lo stato vive sull'occorrenza; il Task non ha stato di esecuzione.

```mermaid
erDiagram
    TASK ||--o{ TASK_OCCURRENCE : genera
    TASK_OCCURRENCE ||--o| COMPLETION : produce
    TASK_OCCURRENCE ||--o{ NOTIFICATION : notifica
    TASK_OCCURRENCE ||--o{ SCHEDULED_NOTIFICATION : schedula

    TASK {
        uuid id PK
        uuid spaceId FK
        text title
        text recurrenceRule
        text timeZone
        boolean emailDigest
        int reminderOffsetMinutes
        timestamptz endedAt
    }
    TASK_OCCURRENCE {
        uuid id PK
        uuid taskId FK
        boolean allDay
        timestamptz startsAt
        timestamptz endsAt
        text status
        timestamptz completedAt
        uuid activityId
    }
    COMPLETION {
        uuid id PK
        uuid occurrenceId FK
        uuid activityId
        timestamptz occurredAt
        jsonb provenance
        uuid rectifiedBy
    }
    NOTIFICATION {
        uuid id PK
        uuid recipientId
        text dedupKey
        text threadKey
        text state
        timestamptz triggerAt
    }
    SCHEDULED_NOTIFICATION {
        uuid id PK
        text dedupKey
        text state
        timestamptz triggerAt
    }
    DIGEST_RUN {
        uuid id PK
        uuid userId
        date digestDate
        text state
    }
```

---

## 7. Modello dati: Knowledge

ADR-0016, ADR-0018. Il documento è la verità; `block` è un indice derivato e ricostruibile. I wikilink vivono dentro il JSON come nodi, non in una tabella.

```mermaid
erDiagram
    SPACE ||--o{ DOC : contiene
    DOC ||--o{ BLOCK_INDEX : indicizza

    DOC {
        uuid id PK
        uuid spaceId FK
        text title
        text kind
        jsonb content
        int schemaVersion
        text sensitivity
        int version
        timestamptz deletedAt
    }
    BLOCK_INDEX {
        uuid id PK
        uuid docId FK
        uuid blockId
        int position
        text type
        text text
        text links
        text sensitivity
        text contentHash
    }
    ATTACHMENT {
        uuid id PK
        text r2Key
        text mime
        text sha256
        timestamptz createdAt
    }
```

Note:

- `DOC.kind` = `page` | `note`. Una nota è un documento referenziato da un'entità con `EntityRef`.
- `BLOCK_INDEX.links` contiene i `docId` risolti dei wikilink: i backlink sono una query, non una scansione.
- Un wikilink rotto non ha `docId` e non entra in `links`.
- `ATTACHMENT` non è nel documento: il nodo immagine porta solo `attachmentId`.

---

## 8. Modello dati: Habits

ADR-0014, ADR-0015, ADR-0019. Nessuna tabella periodo: il periodo è derivato da configurazione, tempo e timezone.

```mermaid
erDiagram
    SPACE ||--o{ HABIT : attiva
    HABIT ||--o{ HABIT_CONFIG_VERSION : versiona
    HABIT ||--o{ HABIT_PAUSE : sospende
    HABIT ||--o{ HABIT_SOURCE_BINDING : collega
    HABIT ||--o{ HABIT_EVIDENCE : raccoglie
    TASK ||--o{ HABIT_SOURCE_BINDING : alimenta

    HABIT {
        uuid id PK
        uuid spaceId FK
        text name
        text state
    }
    HABIT_CONFIG_VERSION {
        uuid id PK
        uuid habitId FK
        int target
        text granularity
        text timeZone
        text effectiveFromPeriod
    }
    HABIT_PAUSE {
        uuid id PK
        uuid habitId FK
        timestamptz from
        timestamptz to
    }
    HABIT_SOURCE_BINDING {
        uuid id PK
        uuid habitId FK
        uuid taskId FK
        text state
        text closeReason
    }
    HABIT_EVIDENCE {
        uuid id PK
        uuid habitId FK
        uuid activityId
        text periodKey
        timestamptz occurredAt
        jsonb provenance
        uuid rectifiedBy
    }
```

Derivati a runtime, senza tabella: periodo (`periodKey`), stato del periodo (`met`, `missed`, `paused`, `not_evaluated`), forza dell'abitudine (`strength`, campionata a fine periodo), streak, aggregati per Area e globale.

---

## 9. Modello dati: AI e policy

ADR-0007, ADR-0008. La `PolicyDecision` è immutabile per turno; le Proposal non sono dominio.

```mermaid
erDiagram
    CONVERSATION ||--o{ MESSAGE : contiene
    CONVERSATION ||--o{ PROPOSAL : propone
    PROPOSAL ||--o{ PROPOSAL_EFFECT : compone
    SCOPE ||--o{ POLICY_DECISION : alimenta
    SOURCE ||--o{ SOURCE_GRANT : autorizza
    SOURCE ||--o{ ENTITY_SOURCE : origina

    CONVERSATION {
        uuid id PK
        text sensitivity
        int scopeVersion
    }
    MESSAGE {
        uuid id PK
        uuid conversationId FK
        text role
        jsonb policySnapshot
    }
    PROPOSAL {
        uuid id PK
        uuid conversationId FK
        text state
        text explanation
        jsonb policySnapshot
        uuid idempotencyKey
    }
    PROPOSAL_EFFECT {
        uuid id PK
        uuid proposalId FK
        int order
        text commandName
        jsonb preconditions
        text state
    }
    SCOPE {
        uuid id PK
        int version
        jsonb spaceRoots
        jsonb entityGrants
    }
    SOURCE_GRANT {
        uuid sourceId FK
        boolean ingest
        boolean ai
        boolean retain
    }
```

---

## 10. Macchine a stati

### 10.1 Occorrenza di un task

ADR-0004. Le transizioni sono terminali; la riapertura passa da una rettifica.

```mermaid
stateDiagram-v2
    [*] --> open
    open --> completed: complete
    open --> skipped: skip
    open --> cancelled: cancel
    completed --> open: reopen con Rectification
    skipped --> open: reopen con Rectification
    cancelled --> open: reopen con Rectification
    completed --> completed: completed
```

### 10.2 Periodo di un habit

ADR-0014. Derivato, non memorizzato come macchina a stati.

```mermaid
stateDiagram-v2
    [*] --> not_evaluated: periodo parziale
    [*] --> paused: pausa intersecata
    [*] --> open: periodo corrente
    open --> met: evidenceCount maggiore o uguale al target
    open --> missed: periodo chiuso sotto target
    met --> met: chiuso
    missed --> met: rettifica di una evidenza
    met --> missed: revoca di una evidenza
```

### 10.3 Binding di un habit

ADR-0015.

```mermaid
stateDiagram-v2
    [*] --> active
    active --> disabled: utente
    disabled --> active: utente
    active --> closed: task completato o cancellato
    active --> closed: serie terminata
    disabled --> closed: target terminale
    closed --> [*]
```

### 10.4 Proposal

ADR-0007.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> approved: utente approva
    pending --> rejected: utente rifiuta
    pending --> expired: conversazione chiusa
    approved --> applied: tutti gli effetti ok
    approved --> partial: alcuni effetti falliti
    partial --> applied: retry riuscito
    applied --> [*]
    rejected --> [*]
    expired --> [*]
```

---

## 11. Flusso: completare un task

ADR-0004, ADR-0006, ADR-0015. Il caso guida "compra fiori": un task, un'evidenza, una notifica risolta.

```mermaid
sequenceDiagram
    autonumber
    actor U as Utente
    participant W as web
    participant P as api
    participant T as Tasks
    participant D as Postgres
    participant O as Outbox
    participant H as Habits
    participant N as Notifications
    participant K as worker
    participant E as Resend

    U->>W: completa "Comprare fiori"
    W->>P: comando con commandId
    P->>D: verifica idempotenza
    P->>T: complete(occurrenceId)
    T->>D: Completion + status completed
    T->>O: TaskCompleted con activityId
    D-->>P: commit
    P-->>W: risultato
    W-->>U: riga aggiornata

    K->>O: consuma TaskCompleted
    K->>H: evidenza per binding attivo
    H->>D: insert se non esiste per habit, activity, periodo
    K->>N: risolvi notifiche del thread
    N->>D: pending verso resolved
    Note over K,E: il digest email parte solo se opt-in
```

---

## 12. Flusso: check-in manuale e dedup

ADR-0014, ADR-0015. Due azioni vere nello stesso giorno sono due; la stessa attività esterna è una.

```mermaid
flowchart TD
    A["Utente apre check-in su un habit"] --> B{"Esistono binding attivi?"}
    B -->|no| C["Nuovo activityId"]
    B -->|sì| D["Propone le attività collegate aperte"]
    D --> E{"L'azione è una di quelle?"}
    E -->|sì| F["Riusa il suo activityId"]
    E -->|no| C
    C --> G["Evidenza con provenance manual"]
    F --> H["Evidenza con provenance task"]
    G --> I{"Esiste già habit, activityId, periodKey?"}
    H --> I
    I -->|sì| J["Rifiutata dall'unicità"]
    I -->|no| K["Inserita, score ricalcolato"]
    K --> L["Streak e aggregati si aggiornano da soli"]
```

---

## 13. Flusso: scrivere un documento

ADR-0016, ADR-0018. Una sola transazione: documento e indice dei blocchi non possono divergere.

```mermaid
sequenceDiagram
    autonumber
    participant ED as Editor Tiptap
    participant W as web
    participant P as api
    participant D as Postgres
    participant IX as Indice block
    participant FTS as tsvector

    ED->>ED: modifica locale
    ED->>W: autosave dopo 1-2 s di inattività
    W->>P: saveDocument(docId, json)
    P->>D: BEGIN
    P->>D: update doc content, version
    P->>IX: estrai blocchi, upsert per blockId
    P->>IX: delete dei blocchi scomparsi
    P->>IX: aggiorna position e contentHash
    P->>FTS: aggiorna title e block.text
    P->>D: COMMIT
    D-->>W: ok
    W-->>ED: stato salvato

    Note over P,IX: se un blocco non ha blockId, viene assegnato prima di scrivere
```

---

## 14. Flusso: ricerca e retrieval

ADR-0018, ADR-0008. La ricerca umana vede tutto; l'AI no.

```mermaid
flowchart TD
    Q["Query dell'utente"] --> FTS["Full-text: titolo + block.text, dizionario italiano"]
    FTS --> R1["Risultati: documenti + snippet + Space"]
    R1 --> U1["UI: overlay, nessun filtro con sintassi"]

    subgraph AI["Retrieval AI"]
        A0["PolicyDecision del turno"] --> A1["Filtro Scope e restricted nella query"]
        A1 --> A2["Blocchi di primo livello ammessi"]
        A2 --> A3["DTO minimi + contextRefs"]
        A3 --> A4["Provider esterno"]
        A4 --> A5["Proposal con provenance"]
    end

    R1 -.->|"stesso indice"| A2
```

---

## 15. Flusso: proposta AI

ADR-0007, ADR-0008. Nessuna scrittura senza approvazione; applicazione per effetto.

```mermaid
sequenceDiagram
    autonumber
    actor U as Utente
    participant W as web
    participant O as AI orchestration
    participant PE as PolicyEngine
    participant M as Modello esterno
    participant T as Tool di query
    participant PR as Proposal
    participant C as Comandi dei moduli

    U->>W: chiede qualcosa
    W->>O: turno con Scope
    O->>PE: compila PolicyDecision
    PE-->>O: scopeVersion, grant, modello, gap
    O->>T: query con decisione
    T-->>O: DTO ammessi
    O->>M: prompt + tool definitions
    M-->>O: proposta di azioni
    O->>PR: crea Proposal con effetti ordinati
    PR-->>W: proposta da approvare
    W-->>U: mostra effetti e perché
    U->>W: approva
    W->>PR: approved
    loop per ogni effetto, in ordine
        PR->>C: comando idempotente del modulo
        C-->>PR: esito o errore
    end
    PR-->>W: stato per effetto, anche parziale
    W-->>U: risultato e cosa è cambiato
```

---

## 16. Ciclo di vita: deletion, purge, retention

ADR-0011. La cancellazione nasconde subito; la purge arriva dopo sette giorni; il tombstone resta.

```mermaid
stateDiagram-v2
    [*] --> active
    active --> deleted: delete, deletedAt impostato
    deleted --> active: restore entro la finestra
    deleted --> purged: purge dopo 7 giorni
    purged --> [*]
    note right of purged
        tombstone permanente: type, id, deletedAt
        outbox pendente passa a cancelled
        evidenze e completamenti eliminati
    end note
```

```mermaid
flowchart LR
    subgraph RET["Retention notturna"]
        N["Notification 30 g"]
        CV["Conversation e Message 90 g"]
        ID["Idempotenza 30 g"]
        OB["Outbox pubblicata 7 g"]
        DL["Dead-letter 90 g"]
        JB["Archivio job 30 g"]
        LG["Log 14 g"]
    end
    subgraph KEEP["Non scade"]
        FA["Evidence, Completion"]
        RE["Rectification"]
        PR["Proposal applicate"]
        TM["Tombstone"]
    end
```

---

## 17. Backup, restore, export

ADR-0011, ADR-0009. Il dump è il backup; l'export è il contratto leggibile.

```mermaid
flowchart TB
    subgraph BACKUP["Backup giornaliero — 03:00 UTC"]
        T1["systemd timer"] --> D1["pg_dump -Fc"]
        D1 --> R1["restic su R2"]
        R1 --> H1["healthchecks.io"]
        R1 --> K1["30 giornalieri, 12 settimanali, 12 mensili"]
    end

    subgraph EXPORT["Export — on demand e mensile"]
        E1["pnpm export / comando in app"] --> E2["database.dump"]
        E2 --> E3["schema.sql derivato dal dump"]
        E3 --> E4["MANIFEST con commit, tag, journal, checksum"]
        E4 --> E5["allegati da R2"]
        E5 --> E6["archivio cifrato con age"]
        E6 --> E7["bucket nando-exports, 12 archivi"]
    end

    subgraph RESTORE["Restore — RTO 2-4 h"]
        Z1["Postgres pgvector"] --> Z2["pg_restore --clean"]
        Z2 --> Z3["/srv/nando da restic"]
        Z3 --> Z4["tag immagine dal manifest"]
        Z4 --> Z5["verifica conteggi e health"]
    end
```

---

## 18. Accesso e autenticazione

ADR-0012. Un cancello per ambiente; l'app non ha login.

```mermaid
flowchart TD
    subgraph PROD["Produzione"]
        B1["Browser o PWA"] --> A1["Cloudflare Access<br/>IdP + PIN + MFA"]
        A1 --> W1["web"]
        W1 -->|"bearer token"| P1["api"]
    end

    subgraph STAGE["Staging"]
        B2["Dispositivo nel tailnet"] --> TS["tailscale serve"]
        TS --> W2["web :3002"]
        W2 -->|"bearer token"| P2["api staging"]
    end

    subgraph BREAK["Break-glass"]
        B3["SSH via Tailscale"] --> PF["port-forward 3001"]
        PF --> W1
    end

    subgraph NOPE["Non esiste"]
        X1["login applicativo"]
        X2["sessione in app"]
        X3["api pubblica"]
    end
```

---

## 19. Ticket aperti e roadmap

Stato al 2026-11-05. La roadmap NAS-53 parte quando i suoi blocchi sono chiusi.

```mermaid
flowchart LR
    subgraph DONE["Decisioni chiuse"]
        D1["NAS-51 repo e processi"]
        D2["NAS-47 persistenza"]
        D3["NAS-50 autenticazione"]
        D4["NAS-45 scope v1"]
        D5["NAS-61 e NAS-63 Habits"]
        D6["NAS-54 e NAS-59 Knowledge"]
        D7["NAS-129 forza dell'abitudine"]
        D8["NAS-103 test, CI e ambienti"]
    end

    subgraph OPEN["Aperti"]
        O1["NAS-62 mock di riferimento"]
        O2["NAS-60 UI Habits"]
    end

    subgraph HUMAN["Lavoro umano sull'infrastruttura"]
        H1["NAS-102 doc e compose a tre processi"]
        H2["NAS-104 backup allegati e chiave age"]
        H3["NAS-105 Access, MFA, break-glass"]
    end

    subgraph NEXT["Prossimo"]
        R["NAS-53 roadmap v1"]
    end

    O1 --> R
    O2 --> R
    H1 -.->|"non blocca"| R
    H2 -.->|"non blocca"| R
    H3 -.->|"non blocca"| R
    D1 --> R
    D2 --> R
    D7 --> O2
    D8 --> R
```

---

## Dove vive la verità

| Dato | Verità | Derivato |
| --- | --- | --- |
| Documento | `doc.content` JSON ProseMirror | indice `block`, tsvector, backlink |
| Periodo di un habit | configurazione + tempo + timezone | stato, score, streak, aggregati |
| Forza di un habit | configurazione + tempo + timezone + evidenze non rettificate | `strength` 0–1, campionata a fine periodo |
| Occorrenza di un task | `TaskOccurrence` | `overdue`, viste Calendar |
| Evidenza | `HabitEvidence` non rettificata | score del periodo, forza |
| Notifica | `Notification` e `ScheduledNotification` | badge, centro notifiche |
| Backup | dump + restic | export leggibile |
| Proprietà | `PropertyDefinition` + `PropertyValue` | colonne delle schermate |
| Configurazione deploy | compose nel repository | copia live `/srv/nando` |
