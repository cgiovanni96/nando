# Auth single-user su Cloudflare

**Ticket:** NAS-52 — *Auth single-user su Cloudflare*
**Data:** 26 ottobre 2026
**Stato:** ricerca conclusa, nessuna decisione ratificata. Le marche `[C]`, `[E]`, `[P]`, `[A]` seguono la legenda di `docs/brainstorming/handoff.md` (confermato, esplorativo, proposta, aperto).
**Ambito:** Nando come single-user personal OS, ospitato su Cloudflare (Worker + TanStack Start), esposto su Internet.

> **Nota di metodo.** Le fonti sono documentazione ufficiale Cloudflare, Better Auth e W3C/FIDO, lette il 2026-10-26. I riferimenti `[Fn]` rimandano alla sezione *Fonti* in coda. Non sono state consultate fonti secondarie per le affermazioni tecniche.

---

## 1. La domanda, ridotta ai criteri che contano

Un solo utente, nessuna multi-tenancy, nessun team. I criteri realmente discriminanti non sono "quanti utenti gestisce", ma:

1. **Semplicità di esercizio** — quanto codice e quanta configurazione devo possedere e mantenere.
2. **Recovery** — cosa succede se perdo il telefono, la chiave, l'email o l'accesso a Cloudflare.
3. **Sessioni su più dispositivi** — desktop, laptop, telefono, tablet, senza attriti.
4. **Superficie protetta** — UI *e* API, non solo le pagine.
5. **Costo** — a questa scala deve essere zero o quasi.
6. **Lock-in** — quanto è costoso uscire, e quali dati/credenziali restano ostaggio.

Il vincolo che taglia più di tutti: **un'app single-user non ha bisogno di "auth" come prodotto, ha bisogno di un cancello**. La domanda vera è *dove* mettere il cancello — al bordo (Cloudflare Access) o dentro l'app (Better Auth) — e se serva un secondo cancello dietro il primo.

---

## 2. Cosa gira dove

Questa è la parte che determina tutte le altre risposte, ed è spesso confusa.

```text
Browser / client
   │
   ▼
Cloudflare edge (TLS, WAF, DNS)
   │
   ├── [Cloudflare Access]        ← gira al bordo, PRIMA del Worker
   │     emette CF_Authorization (cookie per-hostname)
   │     + global session su <team>.cloudflareaccess.com
   │     aggiunge l'header Cf-Access-Jwt-Assertion alla richiesta inoltrata
   │
   ▼
Worker (TanStack Start: SSR + server functions + /api/auth/*)
   │
   ├── [Better Auth]              ← gira DENTRO il Worker
   │     legge/scrive user, session, account, verification, passkey
   │
   ▼
D1 (SQLite) / KV
```

**Access è un reverse proxy autenticante, non una libreria.** Non conosce il tuo modello `User`, non emette sessioni applicative, non sa cosa sia un "account Nando". Conosce un'identità esterna (email, gruppo IdP, appartenenza all'account Cloudflare) e la allega alla richiesta come JWT firmato `[F1][F2]`.

**Better Auth è codice tuo.** Gira nel Worker, parla col database, definisce cosa sia un utente e una sessione. Non protegge nulla che non passi da un suo controllo `[F16][F23]`.

Lo scenario assunto dal ticket è esattamente questo: TanStack Start si deploya su Workers con `@cloudflare/vite-plugin` e un `wrangler.jsonc` `[F29]`, quindi il Worker *è* l'origin e un Tunnel non serve. (La scelta di stack resta `[A]` nel handoff: qui è un'assunzione di lavoro, non una decisione.)

Conseguenza operativa: **Access protegge l'ingresso, Better Auth protegge il significato.** Non sono alternativi sul piano concettuale, ma lo sono sul piano "quanto devo costruire".

### 2.1 Il dettaglio che morde su TanStack Start

Su Workers esistono due modi di mettere Access davanti a un Worker:

- **Worker-level Access** — protegge *tutte* le modalità di accesso al Worker: routes, Custom Domains, hostname `workers.dev` e preview `[F3]`. È la scelta giusta, perché una protezione solo per hostname lascia raggiungibile il `*.workers.dev` e le preview.
- **Hostname/path-based Access** — protegge solo quell'URL `[F3]`.

Con Worker-level Access il Worker può leggere l'identità via `ctx.access.getIdentity()`, senza parsing manuale del JWT `[F3]`. **Però**: i Worker con Static Assets girano dietro un router interno che *non* propaga `ctx.access` al Worker dell'utente, e la documentazione nomina esplicitamente TanStack Start fra i framework interessati `[F3]`. Quindi, in questo scenario, `ctx.access` non è affidabile: **la via obbligata è validare `Cf-Access-Jwt-Assertion`** con JWKS, `iss` e `aud` `[F2]`.

Altri due dettagli concreti:

- Access **non supporta WebSocket** con policy a livello di Worker: la connessione fallisce con `403`; serve un'app hostname-based `[F3]`. Rilevante se in futuro Nando usa streaming/SSE/WebSocket.
- La chiave di firma di Access ruota ogni **6 settimane** (la precedente resta valida 7 giorni). Va letta la JWKS e fatto match sul `kid`, mai hardcodare la chiave `[F2]`.

---

## 3. Le opzioni, una per una

### 3.1 Cloudflare Access (Zero Trust)

**Come funziona.** Si crea un'applicazione Access sul dominio del Worker, con policy *deny by default*: nessuno passa se non matcha una Allow `[F1]`. L'autenticazione primaria è delegata a un identity provider — Google, Entra, un OIDC/SAML generico, l'account Cloudflare stesso, oppure il built-in **One-time PIN via email** `[F10][F11]`. Access non gestisce credenziali proprie: non ha password, reset o passkey sue, e la forza dell'autenticazione è quella dell'IdP scelto.

Su questo si innesta **Independent MFA**, che aggiunge un secondo fattore *dentro Access* senza dipendere dall'IdP: TOTP, **security key WebAuthn** e **biometria WebAuthn** (Touch ID, Face ID, Windows Hello). Si possono registrare più chiavi e più biometrie, un solo TOTP per utente `[F7][F8]`. Access offre anche approvazione just-in-time (*Temporary authentication*) e purpose justification: utili in un team, sovradimensionati per un single-user `[F14]`.

**Sessioni.** Due token distinti: *global session* sul team domain (default 24h, configurabile da 15 minuti a **1 mese**) e *application token* sul dominio protetto (da timeout immediato a **1 mese**, default 24h). Alla scadenza dell'application token, se la global session è ancora valida, Access ne emette uno nuovo senza ripromptare l'utente `[F4]`. Ogni browser/device ha il proprio cookie: le sessioni multi-dispositivo sono native, ma **non esiste una vista "dispositivi connessi" né un logout globale lato app**.

**Cosa protegge davvero.** Ogni richiesta HTTP verso l'hostname, quindi UI, server functions, `/api/*`, download `[F1][F6]`. Con Worker-level Access, anche `workers.dev` e le preview `[F3]`. In più, l'opzione account-wide **"Block traffic to all domains in this account"** rende l'intero account deny-by-default: un hostname senza applicazione Access è bloccato con errore `1050` `[F13]`. È la rete di sicurezza che evita l'esposizione accidentale di una preview o di un nuovo dominio.

**Client non-browser.** CLI, script, agenti e job non possono completare il redirect browser. Le strade sono: **service token** (Client ID + Secret, con scadenza; il secret è mostrato una sola volta) `[F9]`, oppure **Managed OAuth**, che trasforma Access in un authorization server OAuth 2.0 per l'applicazione `[F12]`. Questo è un punto di design reale per Nando: import WhatsApp, webhook di Calendar, job notturni, un futuro endpoint MCP — tutti finirebbero bloccati dal cancello browser.

**Recovery.** È la parte più forte e più fragile insieme. Forte perché non c'è nulla da "resettare": si rientra con un altro fattore o un altro IdP. Fragile perché **la radice di fiducia è l'email** (con OTP) o **l'account Cloudflare** (con l'IdP Cloudflare): chi controlla quella casella entra. Mitigazioni: due IdP attivi in parallelo (es. Cloudflare account + One-time PIN), MFA indipendente WebAuthn, e recovery codes dell'account Cloudflare conservati offline.

**Lock-in e failure mode specifici.**
- Il **team domain** è parte dell'identità di Access. Se si elimina l'organizzazione Zero Trust, il team name resta **permanentemente riservato e non riutilizzabile**, anche dal medesimo account `[F33]`. Uscita = nuovo team domain, nuova configurazione IdP, tutti gli utenti riautenticati.
- Il claim `sub` è univoco per email *per account*: se l'utente viene rimosso e riaggiunto, cambia `[F5]`. **Non usare `sub` come chiave dei dati applicativi.**
- I custom claim vengono troncati a ~1 KB: non ci si può costruire autorizzazione sopra `[F5]`.
- Access non ha un percorso alternativo: se la configurazione è sbagliata, si resta fuori. Serve una procedura di break-glass scritta (secondo IdP + service token di emergenza in un password manager).
- Costo: **free fino a 50 utenti**, poi 7 $/utente/mese `[F15]`. A un utente: zero.

### 3.2 Better Auth (dentro il Worker)

**Come funziona.** Libreria TypeScript framework-agnostic, con adapter database (Drizzle → SQLite/D1), plugin per passkey, magic link, email OTP, 2FA, bearer token, API key `[F16][F25]`. Nel caso TanStack Start esiste un'integrazione ufficiale: handler montato su una route `/api/auth/$`, plugin `tanstackStartCookies` per il set dei cookie, e protezione di route/server function tramite `beforeLoad` + `ensureSession` `[F23]`.

**Sessioni.** Tabella `session` con token, `userId`, `expiresAt`, `ipAddress`, `userAgent`. Default 7 giorni con refresh sliding (`updateAge` 1 giorno). API per listare, revocare una singola sessione, revocare le altre, revocare tutte `[F21]`. Multi-dispositivo e "logout da qui / da ovunque" sono nativi — cosa che Access non offre.

**Fattori disponibili.**
- **Passkey/WebAuthn** via SimpleWebAuthn, con `rpID`, `origin`, `authenticatorSelection` (attachment, residentKey, userVerification), conditional UI/autofill `[F17]`.
- **Magic link**: default 300 s, token consumato atomicamente al primo tentativo, rate limit 5/60 s `[F18]`.
- **Email OTP**: sign-in, verifica email, reset password `[F19]`.
- **2FA** con TOTP o OTP e **backup codes** `[F20]`.

**Cosa protegge.** Solo ciò che attraversa un controllo. Le route statiche restano pubbliche (accettabile), ma **ogni server function e ogni endpoint API va guardato esplicitamente**. La documentazione TanStack Start mostra il pattern corretto — `ensureSession` dentro la server function — ma è una disciplina, non un default `[F23]`. Un `createServerFn` dimenticato è una falla silenziosa. Mitigazione: un unico middleware/entry guard + un test che enumeri le server function e verifichi che nessuna sia raggiungibile senza sessione.

Per i client non-browser Better Auth offre il plugin **bearer** (token di sessione in `Authorization`), ma la documentazione avverte esplicitamente che va usato con cautela e solo dove i cookie non sono praticabili `[F24]`.

**Recovery.** Passkey persa → si rientra con magic link o email OTP; 2FA → backup codes. Ma il punto debole si sposta sull'**invio email dal Worker**: un Worker non ha SMTP, serve un provider HTTP (es. Resend) `[F31]`. Se il provider è giù o il dominio non è verificato, la recovery non esiste. Serve almeno un backup code cartaceo e una procedura di ripristino via D1.

**Lock-in.** Basso sul piano dei dati: utenti, sessioni e credenziali stanno nel tuo D1, e la libreria è OSS. Alto sul piano della *churn*: la documentazione è versionata (1.7 latest, 1.8 beta) `[F34]` e i plugin si sono già spostati in package separati (`@better-auth/passkey`) `[F17]`. Il costo è manutenzione, non prigionia.

**Vincoli runtime verificati.** Better Auth usa `scrypt` di default `[F22]`; su Workers `node:crypto` è supportato e le eccezioni dichiarate (`argon2`, `randomUUIDv7`, curve `ed448`/`x448`, DSA/DH, FIPS) non riguardano `scrypt` `[F30]`. Lo stack regge, a condizione di una `compatibility_date` ≥ 2026-08-04 o del flag `nodejs_compat`.

### 3.3 Passkey/WebAuthn nativi (senza libreria)

Non è un'opzione seria da implementare a mano, ma è utile sapere cosa garantisce e cosa no.

- Un credential è **vincolato al RP ID**, che per default è l'effective domain dell'origin; può essere il dominio o un suo suffix registrabile, non un eTLD `[F26]`. **Cambiare dominio invalida tutte le passkey** e impone re-enrollment. WebAuthn L3 mitiga con *related origin requests* (`/.well-known/webauthn`), ma richiede un RP ID comune e un client che supporti la feature `[F26]`.
- Le credenziali discoverable (passkey) permettono sign-in senza username; il flag `BS` indica se il credential è backupato su più dispositivi `[F26]`.
- Il server conserva solo chiavi pubbliche; i provider di sync non possono usare la chiave privata `[F27]`. Questo è il vero vantaggio: niente secret condivisi da rubare.
- **La recovery non è nel protocollo.** La si costruisce: registrare una seconda passkey da sessione autenticata, oppure un fattore di fallback (email OTP) con un flusso di account recovery `[F28]`. Senza questo, un telefono perso è un account perso.
- Attestation e `userVerification` sono decisioni del RP: Better Auth lascia `residentKey` e `userVerification` su `preferred`, quindi per un single-user conviene alzare `userVerification: "required"` e `residentKey: "required"` se si vuole una passkey vera e non un secondo fattore `[F17]`.

Implementarlo a mano significa reimplementare challenge, verifica della firma, counter, origin check, gestione del cookie di challenge. Con Better Auth si ottiene lo stesso risultato con un plugin: **non è una strada da percorrere**.

### 3.4 Solo magic link

Semplicità massima lato utente, complessità minima lato server. Ma: ogni login richiede un round-trip email; il token è single-use e consumato al primo tentativo `[F18]`, quindi **un link preview o uno scanner antispam della casella può bruciarlo** prima del click; non c'è MFA; e la sicurezza dell'account è esattamente la sicurezza della casella email. Va bene come *fallback*, non come unico fattore.

### 3.5 Basic auth dietro Tunnel

Cloudflare Tunnel serve a pubblicare un origin senza IP pubblico, con connessioni outbound-only: **non è un meccanismo di autenticazione** `[F32]`. Il basic auth andrebbe messo nell'app o in un reverse proxy davanti all'origin. Su un'app Worker il Tunnel non serve nemmeno.

Anche nel caso self-hosted, basic auth è la scelta peggiore: password unica condivisa, nessun MFA, nessuna revoca di sessione, nessun logout reale (il browser la tiene), credenziali inviate a ogni richiesta, nessun audit, recovery = modificare un file di configurazione e ridistribuire. **Da scartare.**

---

## 4. Confronto sintetico

| Criterio | Access | Better Auth | Passkey nativo | Magic link | Basic auth |
|---|---|---|---|---|---|
| Codice da scrivere | ~0 | medio | alto | basso | basso |
| Protegge UI + API | sì, ogni richiesta | solo ciò che è guardato | solo il login | solo il login | sì, ma con un solo secret |
| Multi-dispositivo | sì (cookie per browser) | sì + gestione sessioni | sì | sì | sì, senza controllo |
| Revoca sessioni | no per-device (solo durata) | sì, per device | n/a | n/a | no |
| MFA | sì (WebAuthn/TOTP) | sì (TOTP/OTP) | n/a | no | no |
| Recovery | email/IdP, ottima se ridondata | email/backup codes | da costruire | email | modifica config |
| Costo | 0 ≤ 50 utenti | 0 + provider email | 0 | 0 + email | 0 |
| Lock-in | medio-alto (edge) | basso (dati tuoi) | basso | basso | nullo |
| Adatto a Nando | **sì, come cancello** | **sì, come identità** | no | solo fallback | no |

---

## 5. Come si combinano (le tre configurazioni sensate)

### A. Solo Access — "il cancello e basta"

Worker-level Access su tutto il traffico, policy `Allow` sull'email dell'utente, IdP Cloudflare (account member) **più** One-time PIN come fallback, Independent MFA con biometria/security key. Poche righe di codice: solo la validazione del JWT per leggere `email`.

- **Pro:** superficie protetta completa dal primo giorno, recovery banale, zero manutenzione, zero dati di autenticazione da custodire.
- **Contro:** nessuna identità applicativa (l'utente sei tu, ma l'app non lo "sa" in modo strutturato), nessuna lista device, nessun logout globale, nessuna strada per un client nativo senza Managed OAuth.
- **Quando basta:** finché Nando è una web app single-user senza client mobili né job esterni.

### B. Solo Better Auth — "l'identità in casa"

Passkey come fattore primario + email OTP come recovery, `disableSignUp: true`, utente seminato a mano, sessioni in D1, `ensureSession` su ogni server function.

- **Pro:** portabilità totale, controllo fine, sessioni revocabili, `userId` stabile nel dominio, nessuna dipendenza da un edge auth.
- **Contro:** l'app è responsabile della propria sicurezza; un endpoint dimenticato è esposto; serve un provider email; serve bootstrap sicuro del primo utente; la superficie `/api/auth/*` resta pubblica (pur rate-limited).
- **Quando basta:** se si accetta di trattare "auth" come parte del prodotto e di testarne la copertura.

### C. Access + Better Auth — "cancello al bordo, identità dentro"

Access davanti (Worker-level, deny-by-default, MFA WebAuthn), Better Auth dentro per `userId`, sessioni e passkey. Access risponde a *"questa richiesta può raggiungere l'origin?"*; Better Auth a *"chi è l'utente per il dominio?"*.

- **Pro:** difesa in profondità reale; se una server function dimentica `ensureSession`, l'attaccante è comunque fuori dal cancello. È l'unica configurazione in cui un errore applicativo non è immediatamente fatale.
- **Contro:** due login (mitigabile con sessioni lunghe e allineate), due semantiche di logout, due punti di failure, più configurazione.
- **Nota:** non far derivare la sessione Better Auth *solo* dal JWT di Access senza pensare alla scadenza: si creano due orologi che driftano. La pratica più semplice è tenere la sessione app più lunga di quella Access e rifare il login app solo quando serve.

---

## 6. Failure modes e recovery, in pratica

| Scenario | Access | Better Auth | Mitigazione comune |
|---|---|---|---|
| Telefono perso | si rientra con OTP/altro IdP | serve un secondo fattore | secondo device già registrato + backup codes |
| Email compromessa | **accesso completo** | **accesso completo via OTP** | passkey sul provider email, MFA, alert |
| Provider email giù | irrilevante (OTP Access è di Cloudflare) | magic link/OTP morti | passkey come primario, non come unico |
| Dominio cambiato | cookie invalidati, re-login | **passkey invalidate (RP ID)** | decidere il dominio finale prima di enrollare |
| Zero Trust org cancellata | team name perso per sempre | irrilevante | non cancellare; la ricostruzione è manuale |
| Utente rimosso/riaggiunto | `sub` cambia | `userId` stabile | non chiave su `sub` |
| Server function non protetta | coperta comunque | **falla silenziosa** | guard unico + test di copertura |
| Preview/`workers.dev` | coperti solo con Worker-level | esposti se non c'è Access | Worker-level, non hostname-only |
| WebSocket | 403 con policy Worker-level | funziona | app hostname-based se serve |
| Chiave JWT ruotata | va letta la JWKS | n/a | match su `kid`, no hardcode |

Il punto meno ovvio e più importante: **nessuna delle due opzioni risolve la perdita dell'email**. Access con OTP e Better Auth con magic link hanno la stessa radice di fiducia. Se si vuole che la radice sia un device e non una casella, l'unico modo è passkey primaria — e a quel punto serve comunque un fallback email, perché il protocollo non prevede recovery `[F28]`.

---

## 7. Lock-in, in una riga ciascuno

- **Access:** configurazione non portabile fuori da Cloudflare (ricostruibile via IaC), team domain come identità, `sub` non stabile. Uscire è facile tecnicamente (si elimina l'app), ma si perdono le sessioni e si ricostruisce tutto a mano.
- **Better Auth:** dati e credenziali restano in D1, quindi il lock-in è di *manutenzione* (upgrade di major, plugin che cambiano package), non di dati.
- **Passkey:** il lock-in è il **dominio**. `app.nando.it` e `nando.it` non sono intercambiabili per un credential già registrato, salvo related origin requests con RP ID comune `[F26]`.
- **Cloudflare in generale:** il dominio, la zone e l'account sono il vero asset. Le recovery codes dell'account Cloudflare valgono più di qualsiasi scelta di auth.

---

## 8. Raccomandazione

**[P] Fase 1 — Access only, subito.** Worker-level Access su tutto il traffico, policy `Allow` sulla propria email, IdP Cloudflare + One-time PIN come fallback, Independent MFA con biometria o security key. Nel Worker: validazione di `Cf-Access-Jwt-Assertion` con `jose` + JWKS, `iss` = team domain, `aud` = AUD tag; **non** `ctx.access`, che con Static Assets/TanStack Start non arriva `[F3]`. Attivare anche "Block traffic to all domains" per chiudere le preview `[F13]`. Costo: zero. Codice: una manciata di righe. Questa configurazione soddisfa già tutti e sei i criteri del ticket, tranne la gestione esplicita delle sessioni per device.

**[P] Fase 2 — Better Auth quando serve identità, non prima.** Introdurlo quando compare un bisogno concreto: `userId` stabile per le entità di dominio, sessioni revocabili, un client mobile, un endpoint per agenti. Configurazione minima: `disableSignUp: true`, utente seminato, passkey con `rpID` = dominio definitivo e `userVerification: "required"`, email OTP come recovery, `trustedOrigins` espliciti, `ensureSession` in un unico guard. Access resta davanti come difesa in profondità.

**[P] Da non fare.** Passkey/WebAuthn scritto a mano. Magic link come unico fattore. Basic auth. Esporre Access solo per hostname lasciando aperto `workers.dev`.

**[A] Da decidere prima di implementare, perché è irreversibile a basso costo:**
1. **Dominio definitivo** — determina RP ID, cookie, team domain e URL di callback. Sceglierlo una volta.
2. **Fattore primario** — email OTP (più semplice, radice = casella) vs passkey (più forte, richiede recovery esplicita).
3. **Client non-browser previsti** — se sì, decidere subito fra service token e Managed OAuth, prima di scoprire che i job sono bloccati.
4. **Durata sessioni** — Access max 1 mese; Better Auth default 7 giorni. Allinearle o accettare due login.
5. **Break-glass** — dove vivono le recovery codes e il service token di emergenza.

---

## Sintesi per il ticket

- Access e Better Auth non sono alternative: Access è un proxy autenticante al bordo, Better Auth è una libreria dentro il Worker.
- Access protegge **ogni** richiesta HTTP (UI, server functions, API) senza codice; Better Auth protegge solo ciò che chiama `getSession`.
- Con TanStack Start su Workers, `ctx.access` **non** è disponibile per via dei Static Assets: va validato `Cf-Access-Jwt-Assertion` con JWKS.
- Access va configurato **a livello di Worker**, non di hostname: altrimenti `workers.dev` e le preview restano raggiungibili.
- Independent MFA di Access supporta WebAuthn (security key e biometria) ma solo come **secondo** fattore; l'IdP resta obbligatorio.
- Access è gratuito fino a 50 utenti; oltre, 7 $/utente/mese. A un utente il costo è zero in entrambe le opzioni.
- Better Auth è gratuito e OSS, con sessioni in D1, revoca per device, passkey, magic link, email OTP e backup codes.
- Better Auth richiede un provider email HTTP (niente SMTP nei Worker) e `nodejs_compat` per `scrypt`; su Workers `node:crypto` copre `scrypt` (non `argon2`).
- La passkey è vincolata al **RP ID** = dominio: cambiare dominio invalida le credenziali. Decidere il dominio prima di enrollare.
- Nessuna delle due risolve la perdita dell'email: Access/OTP e Better Auth/magic link hanno la stessa radice di fiducia.
- **Raccomandazione:** fase 1 Access-only (zero codice, MFA WebAuthn, recovery via OTP); fase 2 Better Auth per `userId`, sessioni revocabili e futuri client, con Access davanti come defense in depth.
- Da scartare: WebAuthn scritto a mano, magic link come unico fattore, basic auth dietro Tunnel, Access solo per hostname.

---

## Fonti

Tutte consultate il **2026-10-26**.

**Cloudflare Access / Zero Trust**

1. [F1] Cloudflare — *Publish a self-hosted application to the Internet*. https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
2. [F2] Cloudflare — *Validate JWTs* (esempio Worker con `jose`, JWKS, rotazione chiavi 6 settimane). https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
3. [F3] Cloudflare Workers — *Cloudflare Access* (Worker-level vs hostname, `workers.dev`, preview, `ctx.access`, limite WebSocket, Static Assets/TanStack Start). https://developers.cloudflare.com/workers/configuration/cloudflare-access/
4. [F4] Cloudflare — *Session management* (global session 15 min–1 mese, application/policy session fino a 1 mese). https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
5. [F5] Cloudflare — *Application token* (claim `sub`, `email`, `aud`, `identity_nonce`, troncamento custom claim ~1 KB). https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
6. [F6] Cloudflare — *Authorization cookie* (`CF_Authorization`, cookie per dominio, multi-domain app). https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/
7. [F7] Cloudflare — *Independent MFA* (TOTP, security key WebAuthn, biometrics WebAuthn, un TOTP per utente). https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/
8. [F8] Cloudflare — *Enforce MFA* (MFA IdP-based vs independent, precedenza Policy > Application > Organization). https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/
9. [F9] Cloudflare — *Service tokens* (Client ID/Secret, secret mostrato una sola volta, scadenza). https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
10. [F10] Cloudflare — *One-time PIN login* (PIN 10 minuti, nessuna email per utenti bloccati). https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
11. [F11] Cloudflare — *Cloudflare as identity provider* (default per nuove org, restrizione ai membri dell'account). https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/
12. [F12] Cloudflare — *Managed OAuth* (client non-browser, OAuth 2.0, RFC 8707). https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/
13. [F13] Cloudflare — *Require Access protection* ("Block traffic to all domains", errore 1050). https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/require-access-protection/
14. [F14] Cloudflare — *Temporary authentication* (approvazione JIT, max 24h). https://developers.cloudflare.com/cloudflare-one/access-controls/policies/temporary-auth/
15. [F15] Cloudflare — *Access | Zero Trust Network Access*, sezione Pricing (Free sotto 50 utenti; 7 $/utente/mese pay-as-you-go). https://www.cloudflare.com/sase/products/access/

**Better Auth**

16. [F16] Better Auth — *Introduction*. https://www.better-auth.com/docs/introduction
17. [F17] Better Auth — *Passkey plugin* (`rpID`, `origin`, `residentKey`, `userVerification`, conditional UI, SimpleWebAuthn). https://www.better-auth.com/docs/plugins/passkey
18. [F18] Better Auth — *Magic link* (default 300 s, token single-use atomico, rate limit 5/60 s). https://www.better-auth.com/docs/plugins/magic-link
19. [F19] Better Auth — *Email OTP* (sign-in, verifica, reset). https://www.better-auth.com/docs/plugins/email-otp
20. [F20] Better Auth — *Two-Factor Authentication* (TOTP/OTP, backup codes, trusted devices, `allowPasswordless`). https://www.better-auth.com/docs/plugins/2fa
21. [F21] Better Auth — *Session management* (7 giorni default, `updateAge`, list/revoke, cookie cache e revoca ritardata). https://www.better-auth.com/docs/concepts/session-management
22. [F22] Better Auth — *Security* (scrypt di default, CSRF/origin validation, `trustedOrigins`, rotazione secret). https://www.better-auth.com/docs/reference/security
23. [F23] Better Auth — *TanStack Start integration* (handler `/api/auth/$`, `tanstackStartCookies`, `ensureSession` nelle server function). https://www.better-auth.com/docs/integrations/tanstack
24. [F24] Better Auth — *Bearer Token Authentication*. https://www.better-auth.com/docs/plugins/bearer
25. [F25] Better Auth — *Drizzle ORM Adapter*. https://www.better-auth.com/docs/adapters/drizzle

**Standard e piattaforma**

26. [F26] W3C — *Web Authentication: An API for accessing Public Key Credentials — Level 3*, W3C Recommendation, 25 agosto 2026 (RP ID, discoverable credential, flag `BS`, related origin requests §5.11). https://www.w3.org/TR/webauthn-3/
27. [F27] passkeys.dev (W3C Web Identity & Credentials Adoption CG / FIDO Alliance) — *What are passkeys?*. https://passkeys.dev/docs/intro/what-are-passkeys/
28. [F28] passkeys.dev — *Bootstrapping* (registrazione di una seconda passkey da sessione autenticata, fallback e account recovery). https://passkeys.dev/docs/use-cases/bootstrapping/
29. [F29] TanStack — *Hosting*, sezione Cloudflare Workers (`@cloudflare/vite-plugin`, `wrangler.jsonc`). https://tanstack.com/start/latest/docs/framework/react/guide/hosting
30. [F30] Cloudflare Workers — *Node.js `crypto`* (tutte le API supportate tranne `argon2`). https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/
31. [F31] Cloudflare Workers — *Send emails with Resend* (invio email via API HTTP dal Worker). https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
32. [F32] Cloudflare — *Cloudflare Tunnel* (connessioni outbound-only; non è un meccanismo di auth). https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/
33. [F33] Cloudflare — *Getting started with Cloudflare Zero Trust FAQ* (team name permanentemente riservato se l'organizzazione viene eliminata). https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/
34. [F34] Better Auth — *Documentation index* (linee 1.7 latest / 1.8 beta). https://www.better-auth.com/llms.txt
