# 0005 — Core, capability e servizi di piattaforma

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-55 — Calendar interno: vista sui task, range e timezone
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Il modello iniziale trattava Tasks e Calendar come capability componibili, allo stesso livello di Knowledge e Habits. La decisione emersa in NAS-55 ribalta il livello: PARA/Space, Tasks, Calendar, Notifications e una Person minima sono strumenti sempre presenti, e le capability li usano come building block. Serve una regola di dipendenza esplicita, non solo un elenco, altrimenti il core diventa una capability speciale e le capability possono dipendere l'una dall'altra.

## Decisione

### Tre livelli

- **Core**: PARA/Space, Tasks, Calendar, Notifications e Person minima. È sempre disponibile, non si attiva per Space e non dipende da una capability.
- **Capability**: Knowledge, Habits, Learning e Relationships. È opzionale, si attiva per Space con `SpaceCapability` e può usare il core.
- **Piattaforma**: auth, storage, AI orchestration e gli adapter di consegna delle notifiche (email). Sono servizi tecnici, non entità di dominio.

### Regola di dipendenza

- Il core non importa una capability e non conosce i suoi concetti. Tasks non sa cosa è un Habit; Notifications non sa cosa è un Learning plan.
- Una capability può usare il core tramite porte, comandi ed eventi (ADR-0003). Non scrive le tabelle del core.
- Le capability non dipendono l'una dall'altra. Se due capability devono collaborare, passano dal core o da un contratto esplicito.
- La piattaforma è sostituibile: il dominio non conosce il provider di auth, il database o il modello AI.

### Cosa cambia rispetto ad ADR-0002

- `SpaceCapability` registra solo le capability opzionali. Tasks, Calendar, PARA e Notifications sono impliciti e non hanno un record di attivazione.
- Lo Space resta il contenitore e il proprietario dei dati. Le core tool sono disponibili in ogni Space senza empty state di attivazione.
- Disattivare una capability non tocca il core; il core non ha un interruttore.

### Calendar e Notifications

- **Calendar è una vista**, non un aggregato: legge le `TaskOccurrence` con `Schedule` e non ha una tabella propria.
- **Event è un termine di UI**, non un'entità: una voce di calendario è una `TaskOccurrence` con `Schedule`.
- **Notifications è un servizio core** con una porta `NotificationRequest`. Le capability chiedono una notifica; il servizio applica preferenze, deduplica per `(occurrenceId, trigger, channel)` e consegna in-app o via email.
- In-app è sempre disponibile; l'email è configurabile per task; il web push è fuori dalla v1.

## Schema concettuale

```text
Core
  Space, Task, TaskOccurrence, Person, Notification
  Calendar = proiezione di TaskOccurrence con Schedule

Capability
  Knowledge, Habits, Learning, Relationships

SpaceCapability
  spaceId, capabilityKey, config, state   // solo capability opzionali

Platform
  auth, storage, AI orchestration, email delivery
```

## Invarianti

1. Il core non importa una capability.
2. Le capability usano il core tramite porte, comandi ed eventi; non scrivono le sue tabelle.
3. `SpaceCapability` esiste solo per le capability opzionali.
4. Calendar non possiede dati e non duplica le TaskOccurrence.
5. Event non è un'entità di dominio.
6. Notifications non conosce il dominio che ha richiesto la notifica.
7. Le capability non dipendono l'una dall'altra.
8. La piattaforma è sostituibile senza cambiare il dominio.

## Conseguenze

- **ADR-0002**: `SpaceCapability` solo per le capability; Tasks, Calendar, PARA e Notifications sono core impliciti.
- **ADR-0004**: Task copre anche ciò che l'utente chiama evento; Schedule con `from`/`to`; range come una occorrenza; `completed` = avvenuto; `overdue` derivato; Calendar come vista.
- **NAS-55**: si chiude come vista Calendar, non come modello di Event.
- **NAS-83**: Notifiche core ha un ticket proprio.
- **NAS-62**: la dashboard legge core e capability, senza assumere che il core sia una capability.
- **NAS-58**: l'AI propone comandi del core; non crea un secondo percorso per i task.
- **NAS-47**: le tabelle del core e delle capability restano separate; l'outbox è per aggregate.
- **Relationships**: arricchisce Person senza duplicarla; la Person minima resta nel core.

## Alternative scartate

- **Tutto è capability**: il core diventerebbe opzionale, con empty state e attivazione anche per Tasks e Calendar; le capability non avrebbero building block stabili.
- **Tutto è core**: il kernel si allarga a Knowledge, Habits e alle estensioni future, perdendo l'attivazione per Space.
- **Event come entità separata**: tabella quasi sovrapposta a Task, due macchine a stati e due proprietari per lo stesso fatto.
- **Calendar come modulo con tabella propria**: duplica TaskOccurrence e crea due verità da sincronizzare.
- **Notifiche come capability**: ogni capability reinventerebbe consegna, preferenze e dedup.
- **Tabelle condivise tra core e capability**: viola ADR-0003 e congela i confini.
