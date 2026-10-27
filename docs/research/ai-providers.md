# Provider AI per Nando — matrice di valutazione (NAS-42)

**Data della verifica:** 2026-10-26
**Ambito:** scelta del provider AI (o dei provider) per Nando (personal OS, AI supervisionata, modifiche cross-module con approvazione umana).
**Metodo:** solo fonti ufficiali dei vendor, consultate il 2026-10-26. Prezzi in USD per milione di token (MTok), salvo diversa indicazione. Nessun provider è raccomandato in assoluto: la matrice espone i trade-off e la scelta cambia con il vincolo dominante.

> Nota di lettura: i listini AI cambiano spesso e diversi prezzi sono promozionali con scadenza esplicita. Le date di scadenza sono riportate dove presenti. I prezzi "cached" sono sempre per token di input serviti da cache, non per token scritti in cache.

---

## 1. Vincoli di Nando

Nando non è un carico da milioni di chiamate: è un assistente personale con poche centinaia di chiamate al giorno, spesso raggruppate in sessioni, in italiano, con accesso a dati personali (calendario, attività, note, moduli). L'AI propone modifiche cross-module e l'utente le approva: servono quindi

- **tool calling** affidabile e con più chiamate per turno (una proposta può toccare più moduli);
- **structured output** validabile lato server prima di mostrare il pulsante di approvazione;
- **streaming** per non far percepire latenza;
- **prompt caching** perché il system prompt e il contesto dei moduli sono grandi e ripetuti;
- **embedding** per memoria semantica e ricerca;
- **retention e data residency** compatibili con dati personali europei;
- **costi prevedibili**, ma il volume è così basso che il prezzo per token non è il criterio principale.

Il vincolo che taglia più degli altri è la **data residency EU**: è un requisito architetturale, non una preferenza, se Nando deve trattare dati personali senza trasferimenti extra-UE.

---

## 2. Capability matrix

### 2.1 Tool calling

| Provider | Cosa offre (2026-10-26) | Note per Nando |
| --- | --- | --- |
| **OpenAI** | Function calling con schema JSON, `strict: true` per validazione, parallel tool calls, loop multi-turn nelle Responses API. GPT-6 Astra e GPT-6.1 Sol richiedono le **Responses API** per il tool calling; Chat Completions resta disponibile per i modelli precedenti. | Il `strict` è opt-in: in Chat Completions il default è non-strict. Va attivato esplicitamente, altrimenti lo schema è solo un suggerimento. |
| **Anthropic** | Tool use con `input_schema`, `tool_choice` (`auto`/`any`/`tool`), parallel tool use, fine-grained tool streaming; **strict tool use** (`strict: true`) con grammar-constrained sampling. | La combinazione strict tool use + structured outputs copre sia i parametri delle funzioni sia il payload della proposta. È il profilo più "a prova di hallucination" sul formato. |
| **Google** | Function declarations con `functionCallingConfig` (`AUTO`/`ANY`/`NONE`), parallel function calling e compositional function calling (più funzioni in sequenza dentro lo stesso turno). | Il compositional calling è comodo per workflow "leggi → proponi → verifica", ma aumenta i token di output e la latenza percepita. |
| **Locale** | Ollama supporta tool calling, parallel calls, streaming e agent loop multi-turn; llama.cpp con `llama-server --jinja` espone function calling in stile OpenAI e parser nativi per Llama 3.x, Qwen 2.5, Mistral Nemo, Hermes, Functionary, GPT-OSS. | L'affidabilità dipende dal modello e dal template: va testata sul set di tool reali di Nando, non sul benchmark del modello. |

Il punto pratico: tutti e tre i cloud vendor sanno fare tool calling; OpenAI e Anthropic documentano anche uno **strict mode** sui parametri dei tool, mentre Google vincola la forma dell'output via `responseSchema` ma non documenta un equivalente strict per i parametri delle funzioni. Per Nando, che deve validare proposte di modifica prima dell'approvazione, la garanzia sullo schema è un vantaggio di sicurezza, non un dettaglio.

### 2.2 Structured output

| Provider | Meccanismo | Garanzia |
| --- | --- | --- |
| **OpenAI** | `response_format` con `json_schema` e `strict: true` (Responses API: `text.format`). | Schema garantito sul subset di JSON Schema supportato; il modello può rifiutare con un campo `refusal`. |
| **Anthropic** | Structured outputs con JSON Schema nativo, GA; grammar-constrained sampling. | Schema garantito; lo schema viene compilato in una grammar e messa in cache per 24 ore. |
| **Google** | `responseMimeType: application/json` + `responseSchema` (o `responseJsonSchema`). | Controlled generation: il decoding è vincolato allo schema. |
| **Locale** | JSON mode / grammar a seconda del runtime e del modello. | Nessuna garanzia uniforme: va validato sempre lato server. |

Per Nando la forma utile è una **discriminated union** (`action: "create_task" | "update_event" | ...` con payload tipizzato). Tutti e tre i cloud vendor la supportano: OpenAI e Anthropic con uno strict mode documentato, Google con il controlled decoding di `responseSchema`. In tutti i casi, la validazione server-side resta obbligatoria: lo schema garantisce la forma, non la semantica.

### 2.3 Streaming

Tutti i provider cloud usano **SSE**; Ollama usa NDJSON, llama.cpp SSE.

- **OpenAI** streams con eventi semantici (delta di testo, delta degli argomenti delle function call).
- **Anthropic** streams con `content_block_delta` (`text_delta`, `input_json_delta`); il fine-grained tool streaming riduce il buffering degli input dei tool.
- **Google** streams con `streamGenerateContent` e parti `functionCall` nei chunk.
- **Locale**: streaming nativo, ma la latenza dipende dall'hardware.

Regola per Nando: lo streaming degli argomenti di un tool produce **JSON parziale**. Non va eseguito nulla finché il payload completo non è validato; il pulsante "Approva" si abilita solo dopo la validazione. Utile anche un idempotency key per evitare doppie applicazioni in caso di retry.

### 2.4 Prompt caching

| Provider | Meccanica | Prezzo del token cache-hit | TTL / controllo | Caveat |
| --- | --- | --- | --- | --- |
| **OpenAI** | Automatico sui prefissi; nessun breakpoint esplicito. | 5–10% dell'input, secondo il modello (es. Terra $0.05 vs $1.00). | Gestito dal provider, non configurabile. | Se il prefisso cambia (es. timestamp in testa), la cache non colpisce. |
| **Anthropic** | Esplicito con `cache_control`; write a 5 minuti o 1 ora. | 10% dell'input (5% su Opus 5.5 e Sonnet 5.5, 2,5% su Fable/Mythos 5.1). | 5 min (write 1,25x) o 1 ora (write 2x). | Il write-premium va ammortizzato: con chiamate sporadiche il 5 minuti non basta. |
| **Google** | Implicito su Gemini 3.x/4; esplicito con storage. Gemini 4 Argon è **solo implicito**. | $0.075/MTok su 3.8 Flash (promo), $0.10/MTok su 4 Argon (promo). | Implicito: nessun controllo. Esplicito: storage $0.50/MTok-ora. | Lo storage si paga anche se la cache non viene letta; con prefissi grandi e uso continuo è poco, con uso sporadico è uno spreco. |
| **Locale** | Riuso del KV cache/prefix in memoria. | $0. | Gestito dal runtime. | Nessun costo, ma occupa VRAM. |

Per un assistente personale le chiamate arrivano a raffica e poi passano ore di silenzio: un TTL di 5 minuti produce pochi hit. Meglio il TTL a 1 ora di Anthropic (pagando il write 2x), la cache implicita di Google (nessun controllo ma nessun costo di storage) o la cache automatica di OpenAI. La cache è efficace solo se il **prefisso è stabile**: system prompt e descrizioni dei tool vanno tenuti identici, con la parte variabile in coda.

### 2.5 Embeddings

| Provider | Modello | Prezzo (2026-10-26) | Note |
| --- | --- | --- | --- |
| **OpenAI** | `text-embedding-3-small` / `text-embedding-3-large` | $0.02 / $0.13 per MTok | 1536 / 3072 dimensioni, riducibili con il parametro `dimensions`; disponibili anche su endpoint EU, con le condizioni della §4. |
| **Google** | `gemini-embedding-2` | $0.20/MTok testo; $0.45 immagine; $6.50 audio; $12 video; batch testo $0.10 | Unico dei tre con embedding multimodali: utile se Nando indicizza note con immagini o audio. |
| **Anthropic** | — | — | Anthropic non offre un modello di embedding e rimanda a Voyage AI (terze parti, con retention separata). |
| **Locale** | Modelli open-weight via Ollama/llama.cpp | $0 marginale | Privacy totale; qualità multilingua da validare sul corpus italiano di Nando. |

Il costo degli embedding è irrilevante ai volumi di Nando: 10.000 note da 500 token sono 5 MTok, cioè $0.10 con OpenAI small e $1 con Google. Il costo vero è la **ri-generazione** quando si cambia modello (dimensionalità e spazio vettoriale diversi) e la gestione dell'indice.

---

## 3. Costi

### 3.1 Listino sintetico

Prezzi per MTok, verificati il 2026-10-26.

| Modello | Input | Input da cache | Output | Note |
| --- | ---: | ---: | ---: | --- |
| **OpenAI gpt-6-luna** | $0.10 | $0.01 | $0.50 | Fascia economica. |
| **OpenAI gpt-6.1-terra** | $1.00 | $0.05 | $5.00 | Fascia media. |
| **OpenAI gpt-6.1-sol** | $2.00 | $0.10 | $10.00 | Fascia alta; tool calling solo via Responses API. |
| **OpenAI gpt-6-astra** | $10.00 | $1.00 | $50.00 | Frontier. |
| **Anthropic Haiku 5.5** | $0.10 | $0.01 | $0.50 | Fino a 100k token di prompt; oltre, $0.50/$2.50. |
| **Anthropic Sonnet 5.5** | $2.00 | $0.10 | $10.00 | Fascia media. |
| **Anthropic Opus 5.5** | $4.00 | $0.20 | $20.00 | Fascia alta. |
| **Anthropic Fable 5.1** | $10.00 | $0.25 | $50.00 | Frontier; cache-hit al 2,5%. |
| **Google Gemini 3.8 Flash** | $0.75 | $0.075 | $3.75 | Promo fino al 2026-12-31; dal 2027 $1.50/$0.15/$7.50. Storage cache $0.50/MTok-ora. |
| **Google Gemini 4 Argon** | $2.00 | $0.10 | $10.00 | Promo fino al 2026-11-30; dal 2026-12-01 $4.00/$0.20/$20.00. Solo caching implicito. |

Batch: Anthropic e Google documentano **−50%**; OpenAI espone Batch e Flex come tier separati (listino dedicato, non quantificato qui). Attenzione: su Anthropic il batch **non è ZDR-eligible** (retention 29 giorni), quindi lo sconto ha un costo di compliance.

### 3.2 Scenario Nando

Assunzioni: **400 chiamate/giorno** (12.000/mese), **4.000 token di input** e **600 token di output** per chiamata → 48 MTok di input e 7,2 MTok di output al mese. Due colonne: nessuna cache e 70% di hit sulla cache.

| Modello | Nessuna cache | 70% cache-hit |
| --- | ---: | ---: |
| OpenAI gpt-6-luna | ~$8 | ~$5 |
| Anthropic Haiku 5.5 | ~$8 | ~$5 |
| Google Gemini 3.8 Flash (promo) | ~$63 | ~$40 + ~$7 storage |
| OpenAI gpt-6.1-terra | ~$84 | ~$52 |
| Google Gemini 4 Argon (promo) | ~$168 | ~$104 |
| OpenAI gpt-6.1-sol | ~$168 | ~$104 |
| Anthropic Sonnet 5.5 | ~$168 | ~$104 |
| Anthropic Opus 5.5 | ~$336 | ~$208 |
| Anthropic Fable 5.1 | ~$840 | ~$512 |
| OpenAI gpt-6-astra | ~$840 | ~$538 |

Lo storage Google è calcolato su un prefisso di 20.000 token tenuto in cache per un mese (20.000 × 720 ore = 14,4 MTok-ora → ~$7,20). Con 100 chiamate/giorno, dividere per quattro.

### 3.3 Come leggere i numeri

- **Il tier economico costa $5–8 al mese**, il tier medio $50–105, il frontier $200–540. La differenza tra "medio" e "frontier" è di 4–5 volte, non di ordini di grandezza: ai volumi di Nando il costo non è il criterio che decide.
- **Il caching sposta il costo del 25–40%** solo se le chiamate sono raggruppate. Con chiamate sporadiche e TTL corto, la colonna "70% cache-hit" è ottimistica. Su Anthropic il write a 1 ora costa 2x: va usato su prefissi che vengono riletti molte volte nella stessa ora.
- **I prezzi promo di Google scadono**: Argon raddoppia il 2026-12-01, Flash il 2027-01-01. Il vantaggio di Google Flash è quindi temporaneo e va ricalcolato a listino pieno.
- **I token di reasoning si pagano come output** (Google li include esplicitamente nel prezzo di output; OpenAI e Anthropic li fatturano come output). Per classificazioni e routing di Nando conviene disabilitare o limitare il reasoning: 2.000 token di reasoning per chiamata aggiungono 24 MTok di output al mese, cioè $12 a $0,50/MTok — più del costo base del tier economico.
- **OpenRouter aggiunge il 5,5% (Standard) o l'8% (Business)** al prezzo del modello; su $104/mese sono $5,70–8,30. **Cloudflare AI Gateway non ha markup in BYOK**, ma applica il 5% sui crediti Unified Billing.
- **Il locale non è gratis**: hardware da €1.500–2.500 ammortizzato su 36 mesi ≈ €42–69/mese, più energia €5–10/mese. Conviene contro il tier medio/frontier, non contro il tier economico.

---

## 4. Retention e data residency

| Provider | Training sui dati API | Retention di default | ZDR | Residenza EU |
| --- | --- | --- | --- | --- |
| **OpenAI** | No, per i dati API. | Log di abuse monitoring fino a 30 giorni; `store=false` disponibile. | ZDR o Modified Abuse Monitoring su approvazione. | **Sì**, endpoint `eu.api.openai.com` con storage e processing regionale per Responses, Chat Completions, Batch, Embeddings. Richiede approvazione sales e MAM/ZDR; +10% sui modelli usciti dal 2026-03-05. Lo schema di Structured Outputs è escluso dal processing regionale. |
| **Anthropic** | No, senza permesso esplicito. | Contenuto di conversazione non trattenuto di default; i Covered Models richiedono 30 giorni. | Su richiesta, a livello di organizzazione. Batch non ZDR (29 giorni); structured outputs ZDR "qualified" (schema in cache 24h). | **No**: `inference_geo` ammette solo `us` e `global`; l'inferenza US-only costa +10%. Nessuna opzione EU. |
| **Google Gemini API** | No su paid tier; **sì su free tier**. | Log di prompt/risposta opt-in, retention 7/14/28/55 giorni (max 55). | Non documentata come opzione self-serve sulla Gemini API. | **No** sulla Gemini API developer; per l'UE servono Vertex AI / Agent Platform con multi-region o endpoint locazionale. |
| **OpenRouter** | Dipende dal provider upstream. | Dipende dal provider upstream. | Toggle ZDR disponibile su tutti i piani. | Solo Business/Enterprise, con routing in-region (`eu.openrouter.ai`), fail-closed. |
| **Cloudflare AI Gateway** | n/a: è un proxy. | Log attivi di default, disattivabili per richiesta. | n/a. | Non cambia la residency del provider upstream. |
| **Locale** | No. | Controllo totale. | n/a. | Nativa. |

La conseguenza pratica è netta:

- Se la residenza EU è **obbligatoria**, le strade sono OpenAI EU (con approvazione e +10%), Vertex AI (non la Gemini API developer) o il locale. Anthropic non è utilizzabile per quel requisito, anche se ZDR e retention di default nulla riducono molto il rischio.
- Se la residenza EU è **preferita ma non obbligatoria**, Anthropic è difendibile con ZDR + nessuna retention di default, accettando il trasferimento negli USA.
- La **Gemini API free tier non va usata** per dati personali: i dati possono essere usati per migliorare i prodotti. Il paid tier no.
- Lo **schema** di structured output non è dato personale e non dovrebbe contenerne: OpenAI lo esclude dal processing regionale, Anthropic lo cachea per 24 ore. È un posto dove non mettere mai nomi, email o contenuti.

---

## 5. Rate limits

| Provider | Modello di limiti (2026-10-26) | Rilevanza per Nando |
| --- | --- | --- |
| **OpenAI** | RPM/TPM/RPD per tier di utilizzo, quote separate per modello; il tier cresce con la spesa. | 400 chiamate/giorno ≈ 0,3 RPM di media: irrilevante anche al tier più basso. Contano solo i burst. |
| **Anthropic** | Tier Start/Build/Scale. Start: 1.000 RPM, 2M ITPM, 400k OTPM (Opus/Sonnet/Haiku); cap di spesa mensile $500/$1.000/$200.000. | Il cap di spesa è più vincolante dei token per un uso personale. |
| **Google** | RPM/TPM/RPD per progetto; tier a consumo crescente (cap di spesa $250 / $2.000 / $20k–100k+); limiti di spesa per finestra di 10 minuti ($10/$50/$200). | Il passaggio al tier a pagamento richiede billing; il free tier non è compatibile con dati personali. |
| **OpenRouter** | Free: 25+ modelli a 20 RPM / 50 RPD (1.000 RPD dopo $10 di crediti). Modelli paid: limiti del provider, pass-through. | Il free tier è utile per prototipare, non per Nando. |
| **Locale** | Limitato dall'hardware e dalla VRAM. | Nessun limite contrattuale; la coda è la GPU. |
| **Cloudflare AI Gateway** | Rate limiting configurabile in fronte al provider. | Utile per mettere un tetto di spesa/abuso, non per aumentare le quote. |

---

## 6. Gateway e opzione locale

### 6.1 OpenRouter

- **Cosa è:** un'unica API compatibile OpenAI su 500+ modelli, con routing e fallback tra provider.
- **Costo:** fee di piattaforma 5,5% (Standard) o 8% (Business) oltre al prezzo del modello; free tier con 25+ modelli a 20 RPM / 50 RPD (1.000 RPD dopo $10 di crediti).
- **Pro:** provare più modelli senza cambiare integrazione; fallback automatico; un solo contratto.
- **Contro:** è un **processor in più** nella catena dei dati; la retention dipende dal provider scelto e non è uniforme; il tool calling non è supportato da tutti i modelli/provider; il routing EU in-region è solo Business/Enterprise (`eu.openrouter.ai`, fail-closed).
- **Per Nando:** utile in fase di benchmark e per un eventuale fallback, non come trust boundary. Se lo si usa, va pinnato il provider per modello e verificata la capability di tool calling per ogni route.

### 6.2 Cloudflare AI Gateway

- **Cosa è:** un proxy davanti al provider con analytics, caching, rate limiting e logging.
- **Costo:** analytics, caching e rate limiting core sono gratuiti su tutti i piani; nessun markup in BYOK; 5% sui crediti Unified Billing.
- **Pro:** osservabilità e controllo centralizzato senza cambiare SDK; caching exact-match utile per prompt deterministici (classificazioni, riassunti); rate limiting per tenant.
- **Contro:** la cache è **solo exact-match** ed è disabilitata di default: per chat e prompt variabili serve a poco. I log sono **attivi di default** e vanno disattivati (`cf-aig-collect-log: false`) o filtrati nel payload. Soprattutto, **non cambia la retention né la residency del provider**: è pass-through.
- **Per Nando:** strato ops utile davanti a un provider già scelto, non un modo per risolvere la residency.

### 6.3 Modelli locali

- **Ollama:** tool calling, parallel calls, streaming, agent loop multi-turn; semplicità di gestione e modelli già impacchettati.
- **llama.cpp:** `llama-server --jinja` con function calling in stile OpenAI; parser nativi per Llama 3.x, Qwen 2.5, Mistral Nemo, Hermes, Functionary, GPT-OSS; fallback generico per gli altri.
- **Hardware:** 24–48 GB di VRAM per modelli di classe 30B, oppure memoria unificata su Mac. Senza GPU adeguata, la latenza rovina l'esperienza di streaming.
- **Pro:** nessun trasferimento, nessuna retention di terzi, nessun rate limit, costo marginale nullo.
- **Contro:** qualità di orchestrazione e rispetto degli schemi inferiore ai frontier; ops (aggiornamenti, template, VRAM); niente SLA.
- **Per Nando:** l'unica opzione con residenza EU nativa e senza processor. Ha senso per i moduli più sensibili o come fallback offline, non necessariamente per tutta l'applicazione.

---

## 7. Matrice decisionale

| Dimensione | OpenAI | Anthropic | Google | Locale |
| --- | --- | --- | --- | --- |
| Tool calling | Completo, `strict`, parallel; Responses API per Astra/Sol | Completo, `strict`, parallel, fine-grained streaming | Completo, parallel + compositional | Variabile per modello |
| Structured output | `json_schema` + strict | JSON Schema GA, grammar-constrained | `responseSchema` | JSON mode/grammar variabile |
| Streaming | SSE | SSE | SSE | NDJSON/SSE |
| Prompt caching | Automatico | Esplicito 5m/1h | Implicito (Argon) / esplicito + storage (Flash) | KV locale |
| Embeddings | Sì, $0.02–0.13/MTok | No | Sì, $0.20/MTok, multimodale | Sì, open-weight |
| Costo mid-tier (400 call/giorno) | ~$52/mese | ~$104/mese | ~$40–47/mese (promo) | ~€47–79/mese TCO |
| Retention | 30 gg abuse log; ZDR su approvazione | Default nessuna; ZDR su richiesta | Log opt-in 7–55 gg | Totale |
| Residenza EU | Sì, con approvazione e +10% | No | Solo Vertex | Nativa |
| Rate limits | Tier per spesa | 1.000 RPM (Start) | Tier per progetto | Hardware |
| Lock-in | Medio (Responses API) | Medio (Messages API) | Medio (Gemini API) | Basso |

**Non esiste un vincitore unico.** La scelta cambia con il vincolo dominante:

- **Residenza EU obbligatoria** → OpenAI EU (con approvazione sales, MAM/ZDR e +10%), Vertex AI per Google, oppure locale. Anthropic resta fuori per questo requisito.
- **Massima affidabilità del tool calling e degli schemi** → OpenAI e Anthropic sono i più vicini; Anthropic ha il profilo più "strict by design", OpenAI ha l'ecosistema più ampio (Responses, Batch, Embeddings, realtime).
- **Costo minimo** → Google Gemini 3.8 Flash finché dura la promo, oppure il tier economico di OpenAI/Anthropic ($5–8/mese), accettando la scadenza delle promo e la minor garanzia sullo schema.
- **Sovranità e dati sensibili** → locale per i moduli sensibili, cloud per il resto, con routing per classe di dato.
- **Sperimentazione multi-modello** → OpenRouter, ma con provider pinnato e consapevolezza che la retention non è uniforme.
- **Osservabilità e controllo di spesa** → Cloudflare AI Gateway davanti al provider scelto, con log disattivati di default.

---

## Sintesi per il ticket

- Nessun provider domina: OpenAI e Anthropic sono più forti su tool calling "strict" e orchestrazione; Google è il più economico nel periodo promozionale; il locale è l'unica residenza EU nativa.
- OpenAI è l'unico dei tre con residenza EU sulle API principali (Responses, Chat, Batch, Embeddings), ma richiede approvazione sales + MAM/ZDR e applica +10% sui modelli usciti dal 2026-03-05.
- Anthropic non offre residenza EU: `inference_geo` ammette solo `us`/`global`; compensa con ZDR e retention di default nulla, ma non basta se la residenza è un requisito legale.
- Gemini API non documenta residenza EU per richiesta: per l'UE serve Vertex/Agent Platform; il free tier può usare i dati per il miglioramento, il paid tier no.
- Su 400 chiamate/giorno (48 MTok input, 7,2 MTok output/mese) il tier medio costa ~$52 (OpenAI Terra), ~$104 (Anthropic Sonnet 5.5, OpenAI Sol, Gemini 4 Argon promo) e ~$208–336 senza caching; il tier economico ~$5–8.
- Le promo di Gemini 4 Argon (fino al 2026-11-30) e 3.8 Flash (fino al 2026-12-31) raddoppiano allo scadere: il vantaggio Google è temporaneo.
- Il caching conviene solo con chiamate raggruppate: 5 minuti di TTL non bastano per un assistente personale sporadico; meglio 1 ora (Anthropic, write 2x), cache implicita (Google) o automatica (OpenAI).
- Anthropic non ha embedding model: per la memoria semantica servono OpenAI ($0.02/MTok small), Google ($0.20/MTok) o un modello locale.
- OpenRouter aggiunge 5,5% (Standard) o 8% (Business) e maschera le differenze di retention; utile per esperimenti, non come trust boundary. EU in-region solo Business/Enterprise.
- Cloudflare AI Gateway non cambia la retention del provider, logga di default (disattivabile) e non ha markup in BYOK: è uno strato ops, non un provider.
- Locale: ~€1.500–2.500 di hardware, ~€42–69/mese ammortizzato + energia; conviene contro il tier medio, non contro quello economico; qualità tool-calling da validare.
- La decisione dipende dal vincolo hard: residenza EU → OpenAI con approvazione, Vertex o locale; qualità tool → OpenAI/Anthropic; costo → Google Flash; sovranità → locale.

---

## Fonti

Tutte le fonti sono state consultate il **2026-10-26**.

### OpenAI

- Pricing — https://developers.openai.com/api/docs/pricing
- Function calling — https://developers.openai.com/api/docs/guides/function-calling
- Structured outputs — https://developers.openai.com/api/docs/guides/structured-outputs
- Prompt caching — https://developers.openai.com/api/docs/guides/prompt-caching
- Embeddings — https://developers.openai.com/api/docs/guides/embeddings
- Rate limits — https://developers.openai.com/api/docs/guides/rate-limits
- Data controls e data residency — https://developers.openai.com/api/docs/guides/your-data

### Anthropic

- Pricing — https://platform.claude.com/docs/en/about-claude/pricing
- Tool use — https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Strict tool use — https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- Structured outputs — https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- API and data retention — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Data residency — https://platform.claude.com/docs/en/manage-claude/data-residency
- Rate limits — https://platform.claude.com/docs/en/api/rate-limits

### Google

- Gemini API pricing — https://ai.google.dev/gemini-api/docs/pricing
- Function calling — https://ai.google.dev/gemini-api/docs/function-calling
- Structured output — https://ai.google.dev/gemini-api/docs/structured-output
- Context caching — https://ai.google.dev/gemini-api/docs/caching
- Embeddings — https://ai.google.dev/gemini-api/docs/embeddings
- Rate limits — https://ai.google.dev/gemini-api/docs/rate-limits
- Logs policy — https://ai.google.dev/gemini-api/docs/logs-policy
- Vertex AI data residency — https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency

### Gateway

- OpenRouter pricing — https://openrouter.ai/pricing
- OpenRouter quickstart — https://openrouter.ai/docs/quickstart
- OpenRouter FAQ (ZDR, in-region routing) — https://openrouter.ai/docs/faq
- OpenRouter limits — https://openrouter.ai/docs/api_reference/limits
- Cloudflare AI Gateway — https://developers.cloudflare.com/ai-gateway/
- Cloudflare AI Gateway pricing — https://developers.cloudflare.com/ai-gateway/reference/pricing/
- Cloudflare AI Gateway caching — https://developers.cloudflare.com/ai-gateway/features/caching/
- Cloudflare AI Gateway logging — https://developers.cloudflare.com/ai-gateway/observability/logging/

### Locale

- Ollama tool calling — https://docs.ollama.com/capabilities/tool-calling
- llama.cpp function calling — https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md

---

_Ultima verifica: 2026-10-26._
