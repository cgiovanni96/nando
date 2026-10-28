# 0013 — Scope v1: perimetro completo e criteri di fatto

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-45 — Scope v1 e criteri di successo
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Il perimetro di v1 era già fissato al charting: Spaces/PARA, Dashboard, Tasks, Calendar interno minimo, Knowledge con editor proprietario, Habits, AI supervisionata. Mancava la parte che rende quelle parole verificabili: quali flussi quotidiani devono funzionare, cosa significa "fatto" per una capability e cosa resta fuori.

Due scelte dell'utente hanno semplificato il problema invece di complicarlo. La prima: **niente scadenze**, perché è un progetto personale. Quindi non esiste una linea di taglio, non c'è una data di rilascio e la roadmap sarà una sequenza, non un piano a scadenza. La seconda: **non esiste un vault Obsidian da importare**. L'import non è rimandato, è irrilevante: Knowledge si costruisce con l'uso.

## Decisione

### Cosa significa v1

**V1 è il perimetro completo e provato, non un traguardo temporale.** Tutte le capability del perimetro esistono, e ognuna ha superato il proprio criterio di fatto. Non esiste una v1 "a metà" con una capability tagliata per rispettare una data, perché la data non esiste.

### Flussi obbligatori

Sei flussi devono funzionare end-to-end. Ognuno è una riga del criterio di fatto della sua capability.

1. **Cattura e collocazione** — creare un task o una nota dalla dashboard e collocarlo in uno Space, o lasciarlo in Inbox. Deve costare meno di dieci secondi.
2. **Giornata** — dashboard con ciò che è dovuto oggi, calendario della settimana, completare o saltare un'occorrenza.
3. **Ricorrenze e promemoria** — un task ricorrente genera occorrenze e notifiche senza intervento; completare una volta non rompe la serie.
4. **Knowledge** — scrivere un documento, collegarlo con backlink, ritrovarlo con ricerca full-text e vederlo nelle viste minime.
5. **Habits** — check-in manuale e da un task collegato, score del periodo e streak, senza doppi conteggi.
6. **AI supervisionata** — chiedere, ricevere una Proposal con effetti ordinati, approvarla o rifiutarla, vedere cosa è cambiato.

La **rassegna settimanale** non è obbligatoria: è utile, ma non serve a dichiarare v1 quotidiano.

### Criterio di fatto per capability

Una capability è fatta quando valgono **tutte e quattro** le condizioni:

1. il flusso selezionato funziona end-to-end **in produzione**, dietro Access;
2. esiste un **test** che lo prova e gira in CI;
3. **nessun dato si perde**: nessuna scrittura silenziosamente scartata, nessuna rettifica che cancella l'originale;
4. l'hai usata per **una settimana senza aggirarla**, cioè senza ricorrere allo strumento che sostituisce.

"Deployata e senza errori" non è un criterio: non dice nulla sull'uso. "Feature-complete rispetto alla spec" nemmeno: dice tutto sul codice e niente sulla vita.

### Non-obiettivi

Fuori dalla v1, non rinviati con una data:

- **PWA, offline, app dedicata**: l'app è web e responsive, senza service worker né cache.
- **Ricerca globale con ranking**: nessun indice unificato fra capability, nessuna ACL di ricerca.
- **Allegati e file** oltre gli attachment del Knowledge.
- **Sync esterni**: Google Calendar, contatti, email, messaggistica.
- **Multi-utente e condivisione**: un solo utente, nessun ruolo.
- **Design system proprietario**: tema Mantine personalizzato e componenti ricorrenti estratti quando ricorrono; nessun pacchetto `ui`, nessuna documentazione di design.
- **Gamification**: nessun punteggio, badge, classifica o streak celebrativo.

**Import da Obsidian**: non è un non-obiettivo, è un tema inesistente. Non c'è un vault da migrare; Knowledge parte vuoto per scelta e cresce con l'uso.

### Interfaccia

- **Tema Mantine personalizzato** dentro `apps/web`, in direzione moderna (riferimento shadcn): il tema è codice, non un pacchetto condiviso.
- **Componenti ricorrenti estratti quando ricorrono**, non in anticipo: `PageHeader`, `EmptyState`, `DataTable`, `FormSection` nascono alla terza occorrenza, non alla prima.
- Nessun pacchetto `ui` (ADR-0010), nessuno Storybook, nessuna revisione visiva formale.

### Criteri non funzionali

- Dashboard con **p95 sotto i 500 ms** da telefono in 4G, misurata sull'ambiente di produzione.
- **Cold start sotto i 5 secondi** dopo un deploy.
- **Zero perdite di dati**: nessun percorso di scrittura che possa scartare in silenzio.
- **Restore verificato mensilmente** (ADR-0011): un backup non provato non conta come criterio soddisfatto.

### Cosa alimenta la roadmap

- La sequenza di build parte dai sei flussi, non dalle capability: Tasks e Calendar prima di Habits, perché Habits legge i completamenti; Knowledge dopo l'editor; l'AI quando esistono i comandi da proporre.
- Nessuna milestone a data. Ogni capability ha il proprio criterio di fatto e la roadmap ordina i prerequisiti.
- Il criterio "una settimana d'uso" rende la roadmap auto-correttiva: una capability non si dichiara fatta perché il codice è scritto.

## Schema concettuale

```text
V1 = perimetro completo + criteri di fatto soddisfatti

Flussi                      Capability
  cattura, collocazione  ─▶ Space, Inbox
  giornata                ─▶ Task, TaskOccurrence, Calendar
  ricorrenze, promemoria  ─▶ Recurrence, Notifications
  scrivere, linkare       ─▶ Knowledge, editor, backlink, search
  check-in, score         ─▶ Habits, Evidence
  proposta, approvazione  ─▶ AI, Proposal, ProposalEffect

Done per capability
  flusso in produzione + test in CI + zero perdite + una settimana d'uso
```

## Invarianti

1. V1 è definita dal perimetro, non da una data.
2. Nessuna capability si dichiara fatta senza il proprio flusso provato in produzione.
3. Nessuna capability si dichiara fatta senza una settimana d'uso reale.
4. Nessun criterio di fatto ammette perdita di dati, nemmeno temporanea.
5. Ogni capability ha un flusso obbligatorio dichiarato; le viste accessorie non sono criteri.
6. Non esiste una linea di taglio: se il tempo stringe, slitta la v1, non una capability.
7. Knowledge parte vuoto: nessun import è previsto, nessuna migrazione è dovuta.
8. L'interfaccia resta Mantine con tema personalizzato; nessun design system proprietario.

## Conseguenze

- **NAS-53:** la roadmap ordina i prerequisiti dei sei flussi, senza milestone a data.
- **NAS-54 / NAS-59:** Knowledge non eredita un import; il criterio è scrivere, linkare e ritrovare su contenuti nuovi.
- **NAS-61 / NAS-63 / NAS-60:** il flusso Habits richiede check-in da task, quindi dipende dai completamenti di Tasks.
- **NAS-62:** la dashboard è la porta dei flussi 1 e 2, non un catalogo di widget da riempire.
- **NAS-58 / ADR-0007:** il flusso AI è obbligatorio, ma solo nella forma supervisionata: nessuna scrittura senza approvazione.
- **ADR-0011:** il "restore verificato mensilmente" diventa un criterio di v1, non solo una buona pratica operativa.
- **Mappa:** il bullet sull'import del vault Obsidian va rimosso da "Not yet specified" e registrato come tema inesistente.

## Alternative scartate

- **Daily driver come due settimane di uso senza fallback:** richiede che Nando sostituisca strumenti che non può sostituire in v1 (Calendar interno, nessun sync) e introduce un gate temporale che l'utente non vuole.
- **Feature-complete rispetto alla spec:** misura il codice, non l'uso; una capability può essere completa e inutilizzabile.
- **Deployata e senza errori:** "senza errori" non è un criterio verificabile, e non dice se ci vivresti dentro.
- **Linea di taglio e ordine di sacrificio:** senza scadenze non esiste un "tempo che stringe"; una linea di taglio sarebbe una decisione su un problema che non c'è.
- **Design system proprietario in v1:** un pacchetto `ui`, token e documentazione per un'app a singolo utente, quando Mantine con un tema copre il bisogno.
- **Import minimo del vault:** non c'è un vault. Il tema è nato da un'assunzione sbagliata.
- **Import completo del vault:** stesso motivo, con un costo molto più alto.
