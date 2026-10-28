# 01 — Dominio, DNS, Tunnel e Access

**Obiettivo:** `giovannicosta.me` resta registrato su GoDaddy; il DNS passa a Cloudflare; l'app è raggiungibile solo via Cloudflare Tunnel + Access.

## Stato attuale verificato (2026-10-27)

Export GoDaddy eseguito prima della migrazione (`giovannicosta.me.txt`):

| Record | Valore | TTL |
| --- | --- | --- |
| NS | `ns33.domaincontrol.com`, `ns34.domaincontrol.com` | 3600 |
| `@` A | `89.233.107.32` | 600 |
| `*` A | `89.233.107.32` | 600 |
| `www` CNAME | `giovannicosta.me` | 3600 |
| `_domainconnect` CNAME | `_domainconnect.gd.domaincontrol.com` | 3600 |
| `send` MX | `10 feedback-smtp.us-east-1.amazonses.com` | 3600 |
| `send` TXT | `v=spf1 include:amazonses.com ~all` | 3600 |
| `resend._domainkey` TXT | chiave DKIM Resend | 3600 |
| `_dmarc` TXT | `v=DMARC1; p=none;` | 3600 |

Correzioni rispetto alla versione precedente di questo documento:

- **Non esiste un record `nando`**: risolveva grazie al wildcard `*`. L'export lo ha rivelato; il wildcard è la ragione per cui ogni sottodominio inesistente puntava alla VPS.
- **`_domainconnect`** è un helper GoDaddy, da non migrare.
- **`nando` non rispondeva `404`**: le porte 80/443 erano chiuse, non c'era nessun HTTP in ascolto.
- **DNSSEC:** non attivo (nessun DS), quindi il cambio NS non richiedeva disattivazioni.

## Migrazione eseguita (2026-10-27)

| Voce | Valore |
| --- | --- |
| Nameserver Cloudflare | `carlane.ns.cloudflare.com`, `jay.ns.cloudflare.com` |
| Zona | `giovannicosta.me`, account `f8ac45b0b39644842abcffe9b05f572e`, piano Free |
| Tunnel | `nando` (`cce14750-ce61-4481-b5d6-080afc8d4961`), token-based |
| Access | 3 app self-hosted, policy `allow-owner` (email del proprietario) |
| Team domain | `sweet-wildflower-f85e.cloudflareaccess.com` |

Verifica end-to-end:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://admin.giovannicosta.me   # 302 -> cloudflareaccess.com
curl -s -o /dev/null -w '%{http_code}\n' https://nando.giovannicosta.me   # 302, poi 502 finché l'app non esiste
```

Note operative emerse:

- **Access non è immediato**: dopo la creazione delle app servono alcuni minuti prima che l'edge applichi le policy. Fino ad allora il traffico passa. Non considerare protetta una hostname finché non risponde `302` verso `*.cloudflareaccess.com`.
- **Un'app Access senza policy non è "deny all"**: il traffico può passare. La policy va creata insieme all'app.
- L'API Access restituisce `504` intermittenti: l'operazione spesso va a buon fine lo stesso, va verificato con una lettura successiva prima di ripetere la scrittura.
- Un token API **account-owned** va verificato su `/accounts/{id}/tokens/verify`, non su `/user/tokens/verify`.

## Da completare

- DNSSEC: Cloudflare è `pending`, ma **il DS non è inseribile dalla zona DNS di GoDaddy** (dopo il cambio NS GoDaddy chiude l'editor della zona, correttamente). Il DS è un record di *registrar*, non di zona: su GoDaddy starebbe in *Domain Settings → DNSSEC*, e per `.me` non è sempre esposto. Stato attuale accettato: senza DS nessun resolver valida, quindi non si rompe nulla e non si guadagna nulla. Se un giorno si passa a Cloudflare Registrar, lì si completa in due click.
- Verificare che Resend sia ancora `verified`.
- Header di sicurezza e HSTS: meglio dall'applicazione, così sono testabili in CI.
- SSL/TLS mode già `full`, `min_tls_version=1.2`, `always_use_https=on`.

## Decisione su apex e `www`

`giovannicosta.me` e `www` restano su A/CNAME proxied verso la VPS e **non** vengono rediretti a `nando`. L'apex è riservato a un futuro portfolio: oggi risponde `522` perché la VPS non ha 80/443 pubblici, ed è accettato. Quando servirà, si punterà a Cloudflare Pages o a un servizio dietro il Tunnel. Non aggiungere Redirect Rules verso Nando: l'apex non è un alias dell'app.


## Target DNS

| Nome | Tipo | Valore | Proxy |
| --- | --- | --- | --- |
| `nando` | CNAME | `<tunnel-id>.cfargotunnel.com` | Proxied |
| `nando-staging` | CNAME | `<tunnel-id>.cfargotunnel.com` | Proxied |
| `admin` | CNAME | `<tunnel-id>.cfargotunnel.com` | Proxied |
| `@` | A | `89.233.107.32` | Proxied — **riservato al portfolio**, nessun redirect |
| `www` | CNAME | `giovannicosta.me` | Proxied — segue l'apex |
| `send` | MX/TXT | invariati (Resend) | DNS only |
| `resend._domainkey` | TXT | invariato (DKIM) | DNS only |
| `_dmarc` | TXT | invariato | DNS only |

Perché `nando-staging` e non `staging.nando`: il certificato **Universal SSL** di Cloudflare copre l'apex e un solo livello di sottodominio (`*.giovannicosta.me`). `staging.nando.giovannicosta.me` sarebbe a due livelli e richiederebbe Advanced Certificate Manager o un certificato custom. `nando-staging` resta a un livello e viene coperto.

Non serve eliminare nulla per `nando`: non esisteva come record, era coperto dal wildcard. `nando-staging` e `admin` sono nuovi. Il wildcard `*` invece **va eliminato**: su Cloudflare verrebbe proxied verso la VPS (porte chiuse) e ogni sottodominio inesistente risponderebbe con un errore dell'origine, nascondendo gli sbagli di battitura.

L'apex e `www` non fanno parte di Nando v1. Se non li usi, lasciali DNS-only o rimuovili; se li proxied con Cloudflare e la VPS non ha 80/443 pubblici, non risponderanno. Decidi prima di chiudere le porte.

## Migrazione DNS a Cloudflare

> **Dopo il cambio dei nameserver, la zona DNS è gestita solo da Cloudflare.** GoDaddy chiude l'editor dei record (`DNS`) e risponde che la gestione è interamente su Cloudflare: è il comportamento corretto, non un errore. Su GoDaddy restano registrazione, rinnovo, nameserver e — a livello di *registrar*, non di zona — eventuali record DS per DNSSEC.
>
> Conseguenza pratica: ogni modifica futura ai record va fatta su Cloudflare; tornare indietro richiede solo riportare i NS a `ns33`/`ns34.domaincontrol.com`, che resta sempre possibile.

### 1. Inventario e backup

Prima di toccare i nameserver, esporta tutti i record da GoDaddy (screenshot o CSV). Verifica con:

```powershell
Resolve-DnsName -Name giovannicosta.me -Type NS -Server 1.1.1.1
Resolve-DnsName -Name giovannicosta.me -Type A  -Server 1.1.1.1
Resolve-DnsName -Name nando.giovannicosta.me -Type A -Server 1.1.1.1
Resolve-DnsName -Name send.giovannicosta.me -Type MX -Server 1.1.1.1
Resolve-DnsName -Name send.giovannicosta.me -Type TXT -Server 1.1.1.1
Resolve-DnsName -Name resend._domainkey.giovannicosta.me -Type TXT -Server 1.1.1.1
Resolve-DnsName -Name _dmarc.giovannicosta.me -Type TXT -Server 1.1.1.1
```

Su Linux/macOS usa `dig`:

```bash
dig NS giovannicosta.me +short
dig DS giovannicosta.me +short
dig A nando.giovannicosta.me +short
dig MX send.giovannicosta.me +short
dig TXT send.giovannicosta.me +short
dig TXT resend._domainkey.giovannicosta.me +short
dig TXT _dmarc.giovannicosta.me +short
```

### 2. Aggiungi la zona a Cloudflare

1. Cloudflare Dashboard → **Add a site** → `giovannicosta.me` → piano **Free**.
2. Cloudflare scansiona i record. Controlla che ci siano: apex A, `www`, `nando`, `send` MX/TXT, `resend._domainkey`, `_dmarc`.
3. Se un record manca, aggiungilo a mano **prima** del cambio NS.
4. Il DKIM è un TXT lungo: incollalo intero, senza spezzarlo.

### 3. Abbassa il TTL (opzionale ma consigliato)

Porta il TTL dei record a 600 secondi un giorno prima del cambio. Cloudflare usa TTL automatici quando il proxy è attivo.

### 4. DNSSEC

Oggi è **off**: non devi fare nulla. Dopo il cambio NS, attivalo su Cloudflare (DNS → Settings → DNSSEC) e verifica:

```bash
dig DS giovannicosta.me +short
```

### 5. Cambia i nameserver su GoDaddy

1. GoDaddy → **My Products** → `giovannicosta.me` → **DNS** → **Nameservers** → **Change** → **Custom**.
2. Inserisci i due nameserver assegnati da Cloudflare (es. `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`).
3. Salva e attendi la propagazione (tipicamente minuti, fino a 24–48 ore).

Verifica:

```bash
dig NS giovannicosta.me +short
```

Quando rispondono i nameserver Cloudflare, la zona è migrata.

### 6. Verifica Resend

Dopo la propagazione, controlla la dashboard Resend. Se il dominio non è più **verified**, verifica i quattro record con i comandi sopra. Non rimuovere `send` MX/TXT, `resend._domainkey` o `_dmarc`: sono necessari per l'invio.

## Cloudflare Tunnel

### Opzione consigliata: token

> Presuppone `cloudflared` installato sulla VPS (vedi `02-vps.md`).

1. Zero Trust → **Networks** → **Tunnels** → **Create a tunnel** → **Cloudflared** → nome `nando`.
2. Copia il **token** (è un segreto).
3. Sulla VPS:

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

4. Nella dashboard del tunnel, aggiungi le **Public Hostnames**:

| Hostname | Service |
| --- | --- |
| `nando.giovannicosta.me` | `http://127.0.0.1:3001` |
| `nando-staging.giovannicosta.me` | `http://127.0.0.1:3002` |
| `admin.giovannicosta.me` | `http://127.0.0.1:3000` |

Il token-based tunnel tiene la configurazione in Cloudflare; in locale non c'è `config.yml`.

### Alternativa: credentials file

```bash
cloudflared tunnel login
cloudflared tunnel create nando
cloudflared tunnel route dns nando nando.giovannicosta.me
cloudflared tunnel route dns nando nando-staging.giovannicosta.me
cloudflared tunnel route dns nando admin.giovannicosta.me
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: nando.giovannicosta.me
    service: http://127.0.0.1:3001
  - hostname: nando-staging.giovannicosta.me
    service: http://127.0.0.1:3002
  - hostname: admin.giovannicosta.me
    service: http://127.0.0.1:3000
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## Cloudflare Access

Crea un'applicazione Access per ogni hostname:

| Applicazione | Policy | Note |
| --- | --- | --- |
| `nando.giovannicosta.me` | Allow: la tua email | MFA obbligatoria; sessione 1 settimana |
| `nando-staging.giovannicosta.me` | Allow: la tua email | MFA; stessa policy |
| `admin.giovannicosta.me` | Allow: la tua email | MFA; meglio se solo da Tailscale/WARP |

- Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
- Aggiungi un **policy** `Allow` con `Emails` = la tua email.
- Abilita **MFA** (o richiedi un IdP con MFA).
- Per l'admin, valuta di non esporlo affatto e di usarlo solo via Tailscale (`http://<tailscale-ip>:3000`).
- Se un monitor esterno deve controllare l'app, crea un **service token** e passalo nell'header `CF-Access-Client-Id`/`CF-Access-Client-Secret`; non creare un bypass pubblico.

## TLS, HSTS e header

- Il TLS è terminato da Cloudflare; l'origine è `http://127.0.0.1`. Non serve certbot.
- SSL/TLS mode: **Full** con origine HTTP su localhost; **Full (strict)** solo se l'origine parla HTTPS (es. Traefik con cert). Evita **Flexible**.
- HSTS: attivalo dopo che tutto è stabile. Inizia con `max-age=31536000`; aggiungi `includeSubDomains` solo se tutti i sottodomini sono HTTPS. Non usare `preload` all'inizio.
- Header consigliati (Cloudflare Transform Rules o app):
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-Robots-Tag: noindex, nofollow`
  - CSP: parti da `default-src 'self'` e aggiungi solo ciò che serve.
- WAF: abilita le regole gestite disponibili sul piano Free; non aspettarti rate limiting avanzato.

## Rollback

1. Su GoDaddy, riporta i nameserver a `ns33.domaincontrol.com` / `ns34.domaincontrol.com`.
2. Attendi la propagazione; i record GoDaddy sono ancora intatti.
3. Non cancellare la zona GoDaddy finché Cloudflare non è stabile per almeno una settimana.

## Checklist

- [ ] Record esportati e verificati
- [ ] Zona aggiunta a Cloudflare, record Resend presenti
- [ ] TTL abbassato
- [ ] Nameserver cambiati su GoDaddy
- [ ] `dig NS` risponde Cloudflare
- [ ] DNSSEC attivato e verificato
- [ ] Resend ancora verified
- [ ] Tunnel creato e hostname configurati
- [ ] Access configurato su `nando`, `nando-staging`, `admin`
- [ ] `nando.giovannicosta.me` risponde dietro Access
- [ ] Porte 80/443 chiuse sulla VPS
- [ ] HSTS e header attivi
- [ ] Rollback documentato
