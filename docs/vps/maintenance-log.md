# Maintenance log

Registro append-only delle manutenzioni. Una riga per intervento; i dettagli stanno nel report della sessione.

| Data (UTC) | Attore | Tipo | Azione | Esito | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-10-27 | umano | setup | Documentazione VPS creata | OK | Target, non ancora eseguito |

## Tipi

- `setup` — bootstrap, DNS, Tunnel, Access.
- `deploy` — rilascio applicativo.
- `backup` — backup manuale o verifica.
- `restore-test` — restore di prova.
- `patch` — aggiornamenti OS/Docker/app.
- `incident` — outage, sicurezza, corruzione.
- `review` — audit accessi, costi, retention.

## Regole

- Non riscrivere righe passate; aggiungi una correzione.
- Niente segreti, token, prompt o contenuti utente.
- Se un intervento fallisce, indica il rollback e lo stato finale.
- Per i restore test, indica il dump usato e l'esito della verifica.
