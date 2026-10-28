# 0012 — Autenticazione single-user: un cancello, nessuna identità in app

- **Stato:** accettato
- **Data:** 2026-10-28
- **Ticket:** NAS-50 — Autenticazione single-user
- **Mappa:** NAS-41 — Nando v1, Fondazione decision-complete

## Contesto

L'ADR-0009 ha lasciato l'autenticazione in due fasi: Access al bordo, Better Auth dentro l'app quando servirà. L'ADR-0010 ha cambiato il terreno su cui quella scelta va rifatta: l'app è un monorepo con tre processi da una immagine, `api` non è raggiungibile dall'esterno e parla con `web` tramite un token interno, `worker` non ha ingressi. La produzione sta dietro Cloudflare Tunnel; **staging non ha Access**, è raggiungibile solo dal tailnet. La ricerca di NAS-52 era scritta per Workers e ha tre conclusioni che qui non si applicano più: niente `workers.dev`, niente preview, niente `ctx.access` da aggirare.

Restano due domande vere. La prima: **chi è l'utente per il dominio?** ADR-0003 richiede un `actorId` per l'idempotenza e ADR-0008 un `userId` per digest e grant. La seconda: **dove si mette il cancello**, sapendo che in staging un cancello al bordo non esiste e che un login applicativo aggiungerebbe un secondo passaggio per ogni dispositivo.

## Decisione

### Un solo cancello

- **Cloudflare Access davanti a `web` in produzione**, policy `Allow` sulla propria email, `deny by default`.
- **Staging non ha Access**: il cancello è il tailnet, già deciso in NAS-51. Non si replica Access su un ambiente che non usa nessun altro.
- **Nessuna autenticazione applicativa in v1**: niente login, niente tabella `session`, niente cookie di sessione, niente provider email per entrare.
- **Better Auth resta la fase 2**, con trigger espliciti (sotto), non con una data.

### Identità applicativa

- Una migrazione semina un unico `User` con UUIDv7 fisso.
- `OWNER_USER_ID` arriva dall'ambiente e diventa l'`actorId` di ogni comando, l'`actor` della Provenance e il `recipientId` delle notifiche.
- **L'app non legge mai header `CF-Access-*`.** Nessun header di un proxy autentica una richiesta: è l'invariante già posto da ADR-0010, e qui diventa operativo. Produzione e staging si comportano in modo identico; cambiare edge non tocca il codice.
- Se `OWNER_USER_ID` manca o non corrisponde a una riga esistente, l'app **non parte**. Un default silenzioso creerebbe dati con un attore fantasma.

### Perimetro

| Superficie | Produzione | Staging |
| --- | --- | --- |
| `web` (UI e server function) | Cloudflare Access | tailnet |
| `api` | rete Docker + bearer token interno | rete Docker + bearer token interno |
| `worker` | nessun ingresso | nessun ingresso |
| `/healthz`, `/api/health` | nessuna autenticazione, solo `127.0.0.1` | idem |
| monitoraggio esterno | service token Access dedicato e ruotabile | check via tailnet |

- `/healthz` e `/api/health` non sono pubblici perché non sono instradati dal tunnel: li chiama il healthcheck di Compose su `127.0.0.1`.
- **Nessun client non-browser in v1**: i job girano nel `worker`, l'AI esce in HTTPS, la manutenzione passa da SSH. Non servono service token applicativi né Managed OAuth; l'unico service token è quello del monitoraggio.

### Recupero e break-glass

- **Due IdP attivi**: account Cloudflare e One-time PIN via email. Il PIN è il percorso comodo da telefono; l'account Cloudflare è la riserva.
- **Independent MFA con WebAuthn** (biometria o security key): secondo fattore che non dipende dall'IdP.
- **Recovery codes dell'account Cloudflare conservate offline**, nel password manager: valgono più di qualunque scelta di auth, perché l'account è la radice dell'edge.
- **Break-glass: SSH via Tailscale e `ssh -L 3001:127.0.0.1:3001`.** Funziona anche con Cloudflare irraggiungibile, proprio perché l'app non ha un secondo login. Nessun service token di emergenza: sarebbe un segreto a lunga vita che aggira ogni fattore, per un caso già coperto.

### Impostazioni del bordo

- **Sessioni**: application token a 1 mese, global session a 1 mese. Con un solo fattore al bordo, riautenticarsi ogni giorno su ogni dispositivo è attrito senza contropartita.
- **Niente "Block traffic to all domains"**: bloccherebbe anche apex e `www`, che `01-domain.md` tiene riservati a un portfolio futuro con A record proxied. La garanzia sta nel tunnel, che espone solo `nando` e `admin`.
- Ogni nuovo hostname passa da Access oppure dal tailnet. Un hostname senza una delle due cose non si crea.

### Browser mobile e PWA

- Il flusso deve funzionare da un browser mobile senza app dedicate: il redirect ad Access è l'unico redirect ammesso dal dominio.
- Su Android un'installazione PWA (WebAPK) **condivide cookie e storage con il profilo Chrome**, quindi la sessione Access vale anche nella finestra standalone. Il login cross-origin mostra la barra "fuori scope" e può passare da una scheda del browser prima di tornare nell'app: è attrito noto, non un blocco.
- Una PWA offline non può validare il cookie di Access offline: l'offline, quando arriverà, sarà una funzionalità della shell e non dell'autenticazione.

### Trigger per Better Auth

Si introduce quando compare almeno una di queste condizioni, non prima:

1. un client esterno chiama l'app (script, CLI, telefono, endpoint per agenti);
2. servono sessioni revocabili per dispositivo o un logout globale;
3. un secondo utente, anche temporaneo, deve accedere;
4. l'app deve funzionare senza Cloudflare davanti, o su un hostname che Access non copre;
5. serve un audit di accesso applicativo, perché quello dell'edge non basta.

Configurazione già decisa per quel giorno: `disableSignUp: true`, utente seminato, passkey con RP ID `nando.giovannicosta.me` e `userVerification: "required"`, email OTP come recovery, `trustedOrigins` espliciti, `ensureSession` in un unico guard. Access resta davanti come difesa in profondità.

## Schema concettuale

```text
Produzione
  Browser / telefono / PWA
    └─ Cloudflare Access (IdP Cloudflare + PIN, MFA WebAuthn)
         └─ Tunnel ─▶ web ──token interno──▶ api ─▶ Postgres
                        │
                        └─ OWNER_USER_ID ─▶ actorId, provenance, recipientId

Staging
  Tailnet ─▶ web ──token interno──▶ api ─▶ Postgres

Assente in v1
  session table, login UI, cookie applicativo, magic link,
  service token applicativo, Managed OAuth
```

## Invarianti

1. Un solo cancello per ambiente: Access in produzione, tailnet in staging.
2. Nessun header di un proxy autentica una richiesta.
3. L'`actorId` è un valore di configurazione verificato al boot, non un default implicito.
4. `api` e `worker` non sono raggiungibili dall'esterno in nessun ambiente.
5. Gli endpoint di health non sono instradati dal tunnel.
6. Nessun client non-browser in v1; l'unico service token è quello del monitoraggio.
7. Il recupero non dipende dall'app: due IdP, MFA WebAuthn, recovery codes offline, break-glass via tailnet.
8. Il flusso di accesso funziona da un browser mobile; nessuna app dedicata è richiesta per entrare.
9. Better Auth entra solo quando uno dei cinque trigger è vero.
10. Il dominio `nando.giovannicosta.me` è definitivo finché esistono credenziali WebAuthn: cambiarlo invalida le passkey.

## Conseguenze

- **ADR-0009:** la fase 1 (Access) diventa la v1 intera; la fase 2 resta con trigger espliciti.
- **ADR-0010:** nessuna modifica alla topologia; il token interno è l'unica autenticazione fra processi.
- **ADR-0003:** `actorId` esiste ed è stabile, quindi l'idempotenza funziona in staging come in produzione.
- **ADR-0008:** `userId` per digest e grant viene da `OWNER_USER_ID`, non da una sessione.
- **ADR-0011:** nessuna tabella di sessione da migrare o esportare.
- **Sicurezza:** nessun token CSRF, perché non esiste una credenziale applicativa da cavalcare; le server function restano protette dal controllo di origin di TanStack Start. Chi raggiunge `web` è il proprietario: Access è l'unica serratura e va trattata come tale.
- **Operazioni:** servono un service token per il monitoraggio, con rotazione, e un runbook di break-glass in `docs/vps/`.
- **NAS-53:** la roadmap non include l'autenticazione applicativa; include la configurazione Access e il suo runbook.

## Alternative scartate

- **Better Auth da subito:** due login per dispositivo, dipendenza da Resend per il recovery, e la disciplina di `ensureSession` su ogni server function — una dimenticanza è una falla silenziosa. Nullo il beneficio finché non esiste un client esterno.
- **Solo Better Auth, senza Access:** perdi un cancello che copre ogni richiesta senza codice, e staging e produzione smettono di differire solo per il bordo.
- **Identità dal JWT di Access:** richiede JWKS, `iss`/`aud` e gestione della rotazione ogni sei settimane; in staging, senza Access, il flusso non esiste. Due comportamenti da mantenere per un'identità che è sempre la stessa.
- **`actorId` costante nel codice:** nessuna FK per Provenance e notifiche, e la fase 2 riparte da zero.
- **Health pubblici:** una route non autenticata che rivela lo stato del sistema, per risparmiare un service token.
- **"Block traffic to all domains":** rompe apex e `www` riservati al portfolio; la garanzia la dà il tunnel.
- **Sessioni a 24 ore:** un login al giorno per dispositivo, senza alcun guadagno su un'app a singolo utente.
- **Service token di emergenza:** un segreto a lunga vita che aggira IdP e MFA, per un caso già coperto dal tailnet.
- **Client esterni previsti ora:** avrebbero costretto a scegliere subito fra service token e Managed OAuth, due configurazioni da mantenere per un bisogno che non esiste.
