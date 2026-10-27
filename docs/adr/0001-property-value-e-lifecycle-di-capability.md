# 0001 — PropertyValue condiviso, lifecycle per capability

- **Stato:** accettato
- **Data:** 2026-10-27
- **Ticket:** NAS-44 — Vocabolario canonico e confini di dominio
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

Knowledge ha bisogno di properties tipizzate sui documenti. Relationships ha bisogno di `PersonFact`, cioè asserzioni su una persona con fonte, validità e confidence. Trattarle come due modelli separati duplica il valore e rende impossibile riusare la stessa property in più capability; trattarle come campi core del dominio congela nel codice ciò che l'utente deve poter definire.

## Decisione

- **Property** e **PropertyValue** sono primitive del kernel condiviso, non proprietà di Knowledge.
- I campi core delle entità (`Task.title`, `Task.dueDate`, `Habit.period`) restano colonne tipizzate. `PropertyValue` copre solo attributi aperti e claim.
- Una capability lega una **lifecycle policy** a una coppia (tipo di entità, Property). Il valore resta generico; il comportamento è codice della capability.
- **Fact** è un ruolo, non un'entità separata: una `PropertyValue` valutata con un lifecycle di asserzione — fonte, validità, confidence, supersessione.
- **Memory** segue lo stesso schema con un lifecycle contestuale e una finestra di validità.

## Conseguenze

- La stessa Property può essere usata da Knowledge e da Relationships senza che una dipenda dall'altra.
- Il modello evita un EAV completo: i campi core restano relazionali e indicizzabili.
- Ogni `PropertyValue` porta una Provenance; il costo è un record di provenance per valore, non per entità.
- Le policy di lifecycle sono codice, non dati: aggiungere una capability non richiede una migrazione dello schema dei valori.
- La persistenza (NAS-47) deve prevedere la tabella dei valori con indice su (entità, Property) e la Provenance collegata.

## Alternative scartate

- **Knowledge proprietaria delle property**: avrebbe reso ogni capability dipendente da Knowledge.
- **Fact come entità separata**: avrebbe duplicato il modello di valore e impedito di riusare la stessa property.
- **Tutti gli attributi come PropertyValue**: EAV completo, con join e vincoli più fragili.
- **Lifecycle come campo del valore**: avrebbe spostato la logica delle capability nel modello dati.
