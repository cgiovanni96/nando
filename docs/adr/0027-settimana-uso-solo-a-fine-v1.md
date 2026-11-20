# 0027 — Settimana d'uso solo a fine v1

- **Stato:** accettato
- **Data:** 2026-11-20
- **Emenda:** ADR-0013 (criterio di fatto 4, invariante 3)
- **Ticket:** NAS-53 — Roadmap v1: sequenza, milestone, criteri di done

## Contesto

ADR-0013 chiede una settimana d'uso reale per dichiarare fatta ogni capability. La roadmap di NAS-53 ne fa anche un gate: la milestone successiva parte solo dopo il verdetto della settimana. Con sei flussi questo significa almeno sei settimane di attesa fra le milestone. In un ciclo di sviluppo rapido, dove il feedback arriva comunque dall'uso dello staging mentre si costruisce il flusso successivo, il gate rallenta senza dare informazioni che la demo e la CI non diano già.

## Decisione

- **Una milestone chiude con demo, CI e staging.** La successiva parte subito, senza attendere una settimana d'uso.
- **Una capability è fatta** quando il flusso funziona sullo staging tailnet, ha un test in CI e nessun dato si perde (criteri 1–3 di ADR-0013).
- **La settimana d'uso resta una sola, in M7:** una settimana di uso reale dei sei flussi in produzione dietro Access, senza aggirare Nando. È il criterio che dichiara la v1.
- L'attrito trovato usando lo staging fra una milestone e l'altra diventa un ticket, non un blocco della milestone in corso.

## Conseguenze

- **ADR-0013:** il criterio 4 e l'invariante 3 valgono per la v1 nel suo insieme, non per la singola capability.
- **NAS-53:** la roadmap toglie la settimana dalle uscite di M1–M6 e dai criteri di done delle capability; M7 la mantiene.
- **docs/staging:** le checklist di demo non hanno più una sezione «Settimana d'uso».

## Alternative scartate

- **Settimana per capability, non bloccante:** corre in parallelo alla milestone successiva, ma lascia aperte più verifiche contemporaneamente e diluisce il segnale.
- **Nessuna settimana d'uso:** la v1 si dichiarerebbe con il codice scritto, che è proprio ciò che ADR-0013 voleva evitare.
