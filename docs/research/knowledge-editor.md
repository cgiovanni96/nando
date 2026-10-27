# Editor rich text per Knowledge: Tiptap vs BlockNote

**Ticket:** NAS-49 — *Editor rich text: Tiptap vs BlockNote*
**Data di accesso alle fonti:** 26 ottobre 2026
**Stato:** ricerca conclusa, nessuna decisione di prodotto ratificata

---

## 1. Domanda e metodo

La domanda del ticket è duplice:

1. un editor "Notion-like" può vivere dentro **TanStack Start + React 19**?
2. tra **Tiptap** e **BlockNote**, quale conviene a Nando per il modulo Knowledge?

Metodo: solo fonti primarie (documentazione ufficiale, registry npm, release GitHub, pagine di licenza/pricing), verificate il 26/10/2026. Nel testo distinguo esplicitamente:

- **Documentato** — affermazione presente in una fonte primaria, con riferimento numerico.
- **Inferenza** — deduzione mia, non scritta nella fonte.
- **Assenza di evidenza** — la fonte non tratta l'argomento (non equivale a "non funziona").

Versioni correnti al momento dell'accesso: **Tiptap 3.32.0** (pubblicata il 13/10/2026), **BlockNote 0.56.0** (14/10/2026), **TanStack Start 1.169.4**, **React 19** come target del progetto [1][2][29].

---

## 2. Risposta breve

**Sì, un editor Notion-like funziona in TanStack Start + React 19** — con entrambi gli editor, e per la stessa ragione: l'editor è un componente **client-only**, mentre TanStack Start permette di scegliere il comportamento SSR per route (`ssr: false`, `ssr: 'data-only'`) e di rinviare l'idratazione dei widget pesanti [30][31][24][7].

La vera scelta non è "quale editor gira nel framework", ma **quanto del modello documentale Nando vuole possedere**. BlockNote è un layer "batterie incluse" costruito *sopra* Tiptap/ProseMirror; Tiptap è il substrato headless. Scegliere Tiptap significa assumersi la UI a blocchi che BlockNote regala; scegliere BlockNote significa accettare un modello dati proprietario, un ciclo 0.x e un escape hatch debole [17][18].

**Raccomandazione: Tiptap 3 come engine, con un block layer interno sottile.** Motivi decisivi nelle sezioni 8–10.

---

## 3. Compatibilità con TanStack Start + React 19

### 3.1 Versioni e peer dependency

| Pacchetto | Versione | Licenza | Peer React | Fonte |
|---|---|---|---|---|
| `@tiptap/react` | 3.32.0 | MIT | `^17 \|\| ^18 \|\| ^19` | [1] |
| `@blocknote/react` | 0.56.0 | MPL-2.0 | `^18 \|\| ^19 \|\| >=19.0.0-rc` | [2] |
| `@tanstack/react-start` | 1.169.4 | MIT | `>=18.0.0 \|\| >=19.0.0` | [29] |

Entrambi dichiarano React 19 nel peer range: è il primo fatto utile, ma il peer range da solo non prova la qualità del supporto.

**Tiptap — supporto React 19 documentato nei changelog.** La release **v3.27.2** (6/7/2026) contiene *"Fix React 19 strict mode compatibility by using `useRef` instead of `useState` for the portal element"*; la **v3.29.0** (24/7/2026) corregge un caso in cui *"React 19 renders a node view component while the editor view is still updating"* [34]. Sono fix specifici e recenti: segno che React 19 è testato, ma anche che l'integrazione ha avuto attrito fino a luglio 2026.

**BlockNote** dichiara React 19 nel peer range [2]; non ho trovato una nota di changelog dedicata (assenza di evidenza, non un problema).

### 3.2 Il pattern SSR corretto

TanStack Start renderizza le route sul server di default, ma espone un controllo per route:

- `ssr: false` — niente `beforeLoad`/`loader` né rendering del componente sul server;
- `ssr: 'data-only'` — `beforeLoad`/`loader` girano sul server (niente waterfall), il componente **no**;
- `defaultSsr: false` — spegne lo SSR per l'intera app [30].

In più, la *deferred hydration* documenta esplicitamente **"rich widgets such as maps, charts, ..., editors, or embeds"** come buoni candidati da non idratare subito [31]. Questa è la prova più diretta che il framework è progettato per convivere con un editor pesante.

**Conseguenza pratica (inferenza):** l'editor va montato in una route o in un boundary client-only. Per le pagine di sola lettura conviene invece renderizzare l'HTML sul server e non spedire affatto il JS dell'editor.

### 3.3 Rendering server del contenuto (read view)

- **Tiptap**: *Static Renderer* converte JSON in HTML, Markdown o React **senza DOM, senza browser e senza istanza editor** — pensato proprio per SSR in Next/Nuxt [5]. Esiste anche l'utility HTML per convertire JSON↔HTML fuori dall'editor [4].
- **BlockNote**: `ServerBlockNoteEditor` (pacchetto `@blocknote/server-util`) fa `blocksToFullHTML`, `blocksToMarkdownLossy`, conversione Yjs [23]. Funziona, ma importa React e componenti custom; la documentazione prevede `withReactContext` per i blocchi React e un `serverExternalPackages` per Next [23]. C'è inoltre un issue aperto (22/10/2026) sul fatto che il server util *"removes its DOM globals"* prima che React sia pronto [35] — attrito reale, non bloccante.

**Inferenza:** per Nando il read view server-side è importante più di quanto sembri: serve a Knowledge index, preview, export, ricerca full-text e retrieval AI senza montare un editor. Il percorso Tiptap (funzione pura JSON→HTML) è più semplice e più robusto di un editor "server" che emula il client.

---

## 4. Document model (JSON)

### Tiptap

Documento = **JSON ProseMirror**, forma `{ type: 'doc', content: [...] }`, con nodi annidati e mark inline. Si legge con `editor.getJSON()` e si ricarica passando lo stesso oggetto a `content` o `setContent` [4]. Lo schema è **strict**: *"You can't use any HTML element or attribute that is not defined in your schema"* — l'HTML non mappato viene scartato al paste [3].

- Vantaggio: il formato è il formato canonico di ProseMirror, non proprietario di un vendor.
- Costo: va progettato e versionato da Nando (nodi custom, attributi, migrazioni).

### BlockNote

Documento = **array di `Block`**:

```ts
type Block = {
  id: string
  type: string
  props: Record<string, boolean | number | string>
  content: InlineContent[] | TableContent | undefined
  children: Block[]
}
```

Ogni blocco ha un **id stabile** ("*a block will keep the same ID from when it's created until it's removed*") e può annidare figli [18]. Il modello è più vicino a Notion di quello di Tiptap: blocchi, non paragrafi con mark.

| Criterio | Tiptap | BlockNote |
|---|---|---|
| Forma | albero ProseMirror (`doc` → nodi) | lista di blocchi con `children` |
| IDs stabili | non di default; serve `@tiptap/extension-unique-id` (MIT) [40] | nativi su ogni blocco [18] |
| Formato proprietario | no (ProseMirror JSON) | sì (BlockNote JSON) [17] |
| Markdown | pacchetto `@tiptap/markdown` MIT [16] | export lossy [25] |
| HTML | utility + Static Renderer [5] | nativo `blocksToFullHTML`, standard HTML lossy [25] |

**Inferenza:** il modello a blocchi di BlockNote è più "Notion" e più comodo per riferimenti a livello di blocco; il modello ProseMirror è più espressivo e più facile da possedere per dieci anni.

---

## 5. Custom nodes

**Tiptap.** `Node.create({...})` con `parseHTML`/`renderHTML`, `addAttributes`, `content`, `group`, e NodeView React per il rendering interattivo [3]. È il livello di estensione nativo di ProseMirror: si può definire qualsiasi struttura, incluso un nodo inline "reference" con attributi tipizzati.

**BlockNote.** Tre primitive: `createReactBlockSpec` (blocchi custom), `createReactInlineContentSpec` (inline custom, con esempio ufficiale di **mention**), custom styles [19][20]. I blocchi custom hanno vincoli espliciti sul contenuto: `content: "inline" | "plain" | "none"`, `children` con `allow`/`exclude`, `layoutOnly` [19]. Le celle di tabella contengono solo `InlineContent[]` [21].

**Conseguenza (documentata + inferenza):** entrambi coprono il caso Nando (reference inline a entità + embed di blocco). BlockNote però impone una tassonomia di contenuto più rigida: un blocco "contenitore" che mixa testo e figli arbitrari richiede più acrobazie; in Tiptap è solo schema.

---

## 6. Tabelle

- **Tiptap**: `TableKit` include Table/Row/Header/Cell; comandi `insertTable`, `addRowBefore/After`, `deleteRow`, `mergeCells`, `splitCell`, `toggleHeaderRow/Column`; opzioni `resizable`, `cellMinWidth`, `handleWidth` [8]. È il set di ProseMirror, quindi maturo e prevedibile.
- **BlockNote**: blocco tabella nativo con `columnWidths`, `headerRows`, `headerCols`, `rowspan`/`colspan`; split celle, colori e header sono **opt-in** via opzione `tables` [21].

**Inferenza:** per un knowledge base personale con tabelle "da nota" sono equivalenti. Tiptap offre più controllo su comportamento e NodeView; BlockNote offre la UI già fatta.

---

## 7. Immagini

- **Tiptap**: `Image` è solo rendering (`<img>`), con `inline` e `resize` (handle di ridimensionamento) [9]. L'upload **non** è incluso: `FileHandler` intercetta drop/paste di file ma non carica nulla, va collegato al backend [10].
- **BlockNote**: blocco `image` con props `url`, `name`, `caption`, `previewWidth` (ridimensionamento), `showPreview` [41]; upload via opzione `uploadFile(file) => Promise<string>` e `resolveFileUrl` per URL firmati [28].

**Inferenza:** BlockNote copre caption + resize + pannello file senza codice; Tiptap richiede di comporre Image + FileHandler + NodeView. Entrambi richiedono comunque storage e serving delle immagini lato Nando.

---

## 8. Paste dal web

- **BlockNote**: catena di paste documentata — VS Code, file, BlockNote HTML, Markdown, HTML, plain text; normalizzazione **best-effort** di Word e Google Docs (liste annidate, placeholder, paragrafi vuoti), con `pasteHandler` personalizzabile [22]. È nel core, gratis.
- **Tiptap**: parsing HTML secondo schema (strict) e paste rules [3]; la pulizia "seria" da Excel/Word/Outlook/Google Docs è affidata a **`@tiptap-pro/extension-paste-handler`**, distribuito dal **registry privato Pro** con token, non su npm pubblico [12][13].

**Questo è un differenziale reale.** BlockNote offre gratis la normalizzazione che Tiptap distribuisce come estensione Pro (registry privato, account richiesto, subscription solo per alcune estensioni) [12][13]. Per Nando (incollare articoli, appunti, tabelle) è un requisito concreto: con Tiptap o si attiva il registry Pro, o si scrivono normalizzatori propri (fattibile ma tempo).

---

## 9. Mentions e backlinks

**Mentions.**
- Tiptap: estensione `Mention` first-party + utility `Suggestion` (typeahead), render personalizzabile, query anche async [11]. Gratis, MIT.
- BlockNote: non c'è un'estensione "Mention" nel core, ma la documentazione fornisce il **recipe ufficiale** con `createReactInlineContentSpec` + suggestion menu [20]. Equivalente funzionale, un po' più DIY.

**Backlinks.** **Nessuno dei due ha backlink nativi**: non compaiono né nella documentazione né negli indici (`llms.txt`) di entrambi i progetti [17]. I backlink sono una responsabilità applicativa in tutti e due i casi.

**Proposta (inferenza di design, non documentata da terzi):**

1. nodo inline `entityRef` con attributi `{ targetType: 'document' | 'task' | 'person' | 'habit' | 'learning_path', targetId, label }`;
2. al salvataggio, una singola traversal del JSON estrae i riferimenti in una tabella indice `document_link(source_id, target_type, target_id, created_at)`;
3. la UI "Referenced by" legge l'indice, non il documento;
4. lo stesso indice alimenta retrieval AI e grafo Knowledge.

Con Tiptap serve `@tiptap/extension-unique-id` per gli anchor stabili dei blocchi (MIT, 3.32.0) [40]; con BlockNote gli id dei blocchi esistono già [18]. Per i backlink *document-level* — il caso Nando: Habits/Learning/Relationships che referenziano un documento — la differenza è irrilevante.

---

## 10. Mobile, licenza, maturità, lock-in

### 10.1 Mobile

- **BlockNote**: formatting toolbar con layout mobile dedicato sopra la tastiera su touch device, documentato; nel 2026 il progetto ha mergiato una serie di PR mobile (toolbar, fix Android Chrome, drag su iOS) [26][39]. È supporto **web mobile**, non app nativa.
- **Tiptap**: headless, nessuna toolbar mobile first-party; la documentazione copre React/Vue/Svelte/vanilla/PHP, non React Native [6]. Il supporto mobile va costruito (o comprato con UI Components).

**Inferenza:** a parità di "web mobile", BlockNote parte avvantaggiato. Se Nando vorrà un'app nativa, nessuno dei due è la risposta: entrambi vivono nel DOM.

### 10.2 Licenza e costi

| | Tiptap | BlockNote |
|---|---|---|
| Core | **MIT** [1] | **MPL-2.0** (file-level copyleft) [27] |
| UI Notion-like | template **a pagamento** ("Notion-like template — Paid"), UI Components incluse dal piano Start **$59/mo** [14][15] | slash menu, drag handle, toolbar **inclusi** [27] |
| Estensioni avanzate | Pro/Cloud: registry privato, alcune con subscription (Comments, AI Toolkit, Conversion, Tracked Changes) [13][15] | pacchetti **XL** (AI, multi-column, exporter PDF/DOCX/ODT/Email/Typst): GPL-3.0 oppure licenza commerciale **$195/mo** (fatturazione annuale) [25][27] |
| Paste cleanup | Pro (`@tiptap-pro/extension-paste-handler`) [12] | core, gratis [22] |

Nota MPL: è copyleft **a livello di file**, non di applicazione; per un'app personale non distribuita non cambia nulla, ma se un giorno Nando distribuisse il codice, le modifiche ai file BlockNote andrebbero pubblicate. MIT elimina la domanda (inferenza giuridica di base, non parere legale).

### 10.3 Maturità

Dati al 26/10/2026:

| Metrica | Tiptap | BlockNote |
|---|---|---|
| Versione | 3.32.0 [1] | 0.56.0 — **mai 1.0** [2] |
| Release ultimi 12 mesi | 75 [42] | 33, di cui **15 minor** (0.42→0.56) [39] |
| Download npm (settembre 2026) | **64,6 M** | **2,44 M** (~26×) [33] |
| GitHub stars | 38.867 | 10.335 [32] |
| Ultimo push | 26/10/2026 | 26/10/2026 [32] |
| Linea precedente ancora mantenuta | sì (v2.27.3, set 2026) [42] | n/a |

BlockNote è **vivo e in crescita**, ma è in `0.x` da anni con breaking change ogni poche settimane: per un archivio personale destinato a durare, è un costo di manutenzione ricorrente. Tiptap ha una linea 3.x stabile, una 2.x ancora patchata e un volume d'uso di un ordine di grandezza superiore.

### 10.4 Lock-in

Il punto più importante, e la fonte è **BlockNote stessa**:

> "It has an opinionated approach to building a rich text editor, and a much simpler API than either Tiptap or Prosemirror, so while it may be based on them, **their APIs are not compatible and rarely exposed**. BlockNote uses its own document model." [17]

- **BlockNote**: il documento è BlockNote JSON; gli export HTML/Markdown sono **lossy**; gli exporter "fedeli" (PDF/DOCX/ODT/Email) sono XL a pagamento [25]. Se il progetto muore o cambia direzione, si esporta perdendo struttura custom. Non si può "scendere" a Tiptap/ProseMirror senza riscrivere il layer.
- **Tiptap**: il documento è ProseMirror JSON; esistono Static Renderer, utility HTML, pacchetto Markdown MIT, e in generale il formato è leggibile da qualunque stack ProseMirror [4][5][16]. Se Tiptap sparisse, il JSON resta utilizzabile con ProseMirror puro.

**Inferenza:** il costo di lock-in di BlockNote è **strutturale** (formato + API), quello di Tiptap è **commerciale** (alcune feature Pro). Sono rischi diversi: il primo è difficile da prezzare, il secondo si prezza ($59–$195/mo).

---

## 11. Alternative credibili

Il ticket chiede di considerarle solo se battono entrambe. Nessuna lo fa; le più vicine meritano comunque una riga.

| Progetto | Stato | Perché non vince |
|---|---|---|
| **Lexical** (Meta) | 0.52.0, MIT, 24k stars, peer React ≥18 [36][32] | Nessuna UI Notion-like: slash menu, drag handle, block UX e mention sono da costruire. Stesso sforzo di Tiptap con ecosistema ProseMirror in meno. |
| **Plate** (Slate) | 53.3.18, MIT, 16,7k stars [37][32] | È il più vicino a "Notion kit", ma su Slate: modello diverso, bug React 19 chiuso di recente [38], documentazione e ricette meno mature di Tiptap. |
| **Novel** | Apache-2.0, ultimo push **gennaio 2025** [38] | Wrapper Tiptap + shadcn, non mantenuto: escluso. |
| **Yoopta** | MIT, 3k stars [32] | Notion-like ma community troppo piccola per un archivio a lungo termine. |

**Inferenza:** la vera alternativa a Tiptap non è un altro editor, è **BlockNote**, che è Tiptap con la UI sopra. La scelta è quindi: comprare quella UI (BlockNote) o costruirla/comprare da Tiptap.

---

## 12. Raccomandazione per Nando

**Adottare Tiptap 3 come engine dell'editor Knowledge**, con queste decisioni collegate:

1. **Storage**: una colonna JSONB `content` con il documento ProseMirror + `schema_version`; mai HTML come source of truth.
2. **Schema Nando**: StarterKit + `TableKit` + `Image` (+ `FileHandler`) + `Mention`/`Suggestion` + un nodo inline `entityRef` e un nodo blocco `entityEmbed` per Task/Person/Habit/Learning/Document.
3. **Backlink**: indice `document_link` derivato dal JSON al save (sezione 9), esposto come pannello "Referenced by" e usato dal retrieval AI.
4. **SSR**: route di lettura con Static Renderer (HTML server, zero JS editor); route di modifica client-only (`ssr: 'data-only'` o `ssr: false`) con `immediatelyRender: false` se mai renderizzata sul server [5][30][7].
5. **Block UX**: slash menu, drag handle, block selection e toolbar floating sono lavoro interno (stima 1–2 settimane con supporto AI); se la pressione di tempo cresce, la leva è il piano Tiptap Start ($59/mo), **non** cambiare engine [15].
6. **Paste**: partire dal parsing schema-strict + paste rules; valutare il Pro PasteHandler solo se il paste da Word/GDocs diventa un dolore ricorrente [12].
7. **Mobile**: rimandare; se serve, toolbar touch dedicata sul modello di quella BlockNote [26].
8. **Escape hatch**: tenere attivo l'export Markdown (`@tiptap/markdown`, MIT) e HTML per ogni documento, come assicurazione sul lock-in [16].
9. **Upgrade policy**: pin della minor, upgrade in branch con test di rendering su documenti reali (Tiptap pubblica 75 release in 12 mesi, ~6 al mese) [42].

### Quando rivedere questa decisione

- Se Knowledge richiede **transclusione a livello di blocco** o editing collaborativo multi-utente in tempi brevi, il modello a blocchi con ID di BlockNote diventa un vantaggio concreto [18].
- Se BlockNote arriva a **1.0** con policy di migrazione e schema stabile, il costo di lock-in scende e va rivalutato.
- Se il team di Nando resta una persona sola e la priorità è "Notion in due settimane", BlockNote è l'unica scorciatoia credibile — accettando 0.x e MPL.

---

## Sintesi per il ticket

- **Sì**: un editor Notion-like gira in TanStack Start + React 19; entrambi gli editor sono client-only e TanStack Start ha `ssr: false` / `ssr: 'data-only'` per route e deferred hydration che cita esplicitamente gli editor.
- **Versioni verificate**: Tiptap 3.32.0 (13/10/2026, MIT, peer React 17/18/19), BlockNote 0.56.0 (14/10/2026, MPL-2.0, peer React 18/19), TanStack Start 1.169.4 (peer React ≥18/19).
- **React 19**: Tiptap ha due fix dedicati a luglio 2026 (strict mode, node view); BlockNote dichiara React 19 nel peer range.
- **Document model**: Tiptap = ProseMirror JSON (non proprietario); BlockNote = Block JSON con `id/type/props/content/children` e id stabili per blocco, ma formato proprietario.
- **Custom nodes**: Tiptap ha schema libero + NodeView React; BlockNote ha `createReactBlockSpec` / `createReactInlineContentSpec` con vincoli espliciti su contenuto e figli (celle tabella solo inline).
- **Tabelle e immagini**: equivalenti nel quotidiano; BlockNote offre caption/resize/upload panel già pronti, Tiptap richiede composizione Image + FileHandler + NodeView.
- **Paste dal web**: BlockNote normalizza Word/Google Docs gratis nel core; Tiptap lo fa con `@tiptap-pro/extension-paste-handler` da registry privato Pro.
- **Mentions**: entrambi coprono il caso; Tiptap con estensione first-party, BlockNote con recipe ufficiale. **Backlinks**: nessuno dei due li ha nativi, vanno costruiti in entrambi i casi.
- **SSR read view**: Tiptap Static Renderer è una funzione pura JSON→HTML senza DOM; BlockNote usa `ServerBlockNoteEditor` (importa React, con attrito residuo su DOM globals).
- **Licenza/costi**: Tiptap MIT ma UI Notion-like a pagamento (da $59/mo) e PasteHandler nel registry Pro (account; subscription per alcune estensioni); BlockNote core MPL-2.0 con UI inclusa e pacchetti XL GPL/commerciale ($195/mo).
- **Maturità**: Tiptap 64,6 M download/mese (set 2026) vs 2,44 M, 38,9k vs 10,3k stars, v3 stabile vs 0.56 con 15 minor in 12 mesi.
- **Raccomandazione**: Tiptap 3 + block layer interno + indice `document_link` per i backlink + Static Renderer per il read view; BlockNote resta il piano B se vince la velocità di ship.

---

## Fonti

Tutte le URL sono state aperte il **26 ottobre 2026**.

1. npm — `@tiptap/react` 3.32.0 (licenza, peer deps) — https://registry.npmjs.org/@tiptap/react/latest
2. npm — `@blocknote/react` 0.56.0 (licenza, peer deps) — https://registry.npmjs.org/@blocknote/react/latest
3. Tiptap Docs — *Tiptap Schemas* — https://tiptap.dev/docs/editor/core-concepts/schema
4. Tiptap Docs — *Output and content handling* (`getJSON`, `setContent`) — https://tiptap.dev/docs/guides/output-json-html
5. Tiptap Docs — *Static Renderer* — https://tiptap.dev/docs/editor/api/utilities/static-renderer
6. Tiptap Docs — *React install* — https://tiptap.dev/docs/editor/getting-started/install/react
7. Tiptap Docs — *Next.js* (`immediatelyRender: false`, hydration) — https://tiptap.dev/docs/editor/getting-started/install/nextjs
8. Tiptap Docs — *Table extension* (`mergeCells`, `resizable`) — https://tiptap.dev/docs/editor/extensions/nodes/table
9. Tiptap Docs — *Image extension* (`resize`) — https://tiptap.dev/docs/editor/extensions/nodes/image
10. Tiptap Docs — *FileHandler extension* (no upload server) — https://tiptap.dev/docs/editor/extensions/functionality/filehandler
11. Tiptap Docs — *Mention extension* — https://tiptap.dev/docs/editor/extensions/nodes/mention
12. Tiptap Docs — *Paste Handler* (`@tiptap-pro/extension-paste-handler`) — https://tiptap.dev/docs/editor/extensions/functionality/paste-handler
13. Tiptap Docs — *How to integrate Tiptap Pro extensions* (registry privato, subscription) — https://tiptap.dev/docs/guides/pro-extensions
14. Tiptap — *UI Components* ("Notion-like template — Paid") — https://tiptap.dev/product/ui-components
15. Tiptap — *Pricing* (Start $59/mo, editor MIT) — https://tiptap.dev/pricing e https://tiptap.dev/pricing.md
16. Tiptap Docs — *Markdown package* (`@tiptap/markdown`) — https://tiptap.dev/docs/editor/markdown/getting-started/installation
17. BlockNote — *llms.txt* (modello proprietario, API Tiptap/ProseMirror "rarely exposed") — https://www.blocknotejs.org/llms.txt
18. BlockNote Docs — *Document Structure* (`Block`, id stabili) — https://www.blocknotejs.org/docs/foundations/document-structure
19. BlockNote Docs — *Custom Blocks* (`createReactBlockSpec`, vincoli `content`) — https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks
20. BlockNote Docs — *Custom Inline Content* (esempio mention) — https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content
21. BlockNote Docs — *Tables* (`TableContent`, opzioni) — https://www.blocknotejs.org/docs/features/blocks/tables
22. BlockNote Docs — *Paste Handling* (ordine, Word/Google Docs) — https://www.blocknotejs.org/docs/reference/editor/paste-handling
23. BlockNote Docs — *Server-side processing* (`ServerBlockNoteEditor`) — https://www.blocknotejs.org/docs/features/server-processing
24. BlockNote Docs — *With Next.js* ("should only be rendered client-side") — https://www.blocknotejs.org/docs/getting-started/nextjs
25. BlockNote Docs — *Format Interoperability* (export lossy, XL Pro Only) — https://www.blocknotejs.org/docs/foundations/supported-formats
26. BlockNote Docs — *Formatting Toolbar* (Mobile Formatting Toolbar) — https://www.blocknotejs.org/docs/react/components/formatting-toolbar
27. BlockNote — *Pricing* (MPL-2.0 core, XL GPL/commerciale $195/mo) — https://www.blocknotejs.org/pricing
28. BlockNote Docs — *File Panel* (`uploadFile`, `resolveFileUrl`) — https://www.blocknotejs.org/docs/react/components/image-toolbar
29. npm — `@tanstack/react-start` 1.169.4 — https://registry.npmjs.org/@tanstack/react-start/latest
30. TanStack Start Docs — *Selective SSR* (`ssr: false`, `'data-only'`) — https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr
31. TanStack Start Docs — *Deferred Hydration* (editor tra i candidati) — https://tanstack.com/start/latest/docs/framework/react/guide/deferred-hydration
32. GitHub API — repo metadata `ueberdosis/tiptap`, `TypeCellOS/BlockNote`, `facebook/lexical`, `udecode/plate`, `steven-tey/novel`, `yoopta-editor/Yoopta-Editor` — https://api.github.com/repos/ueberdosis/tiptap · https://api.github.com/repos/TypeCellOS/BlockNote
33. npm downloads API — settembre 2026: `@tiptap/react` 64.597.142, `@blocknote/react` 2.443.962 — https://api.npmjs.org/downloads/point/2026-09-01:2026-09-30/@tiptap/react · https://api.npmjs.org/downloads/point/2026-09-01:2026-09-30/@blocknote/react
34. Tiptap releases — v3.27.2 (React 19 strict mode), v3.29.0 (React 19 node view) — https://github.com/ueberdosis/tiptap/releases/tag/v3.27.2 · https://github.com/ueberdosis/tiptap/releases/tag/v3.29.0
35. BlockNote — issue #3237, *server-util: wait for React before the editor removes its DOM globals* (aperto 22/10/2026) — https://github.com/TypeCellOS/BlockNote/issues/3237
36. npm — `@lexical/react` 0.52.0 (MIT, peer React ≥18) — https://registry.npmjs.org/@lexical/react/latest
37. npm — `platejs` 53.3.18 (MIT, peer React ≥18) — https://registry.npmjs.org/platejs/latest
38. GitHub API — `steven-tey/novel` (ultimo push 18/01/2025); issue Plate #4557 "Editor UI renders incorrectly ... in React 19" (chiuso 26/10/2026) — https://api.github.com/repos/steven-tey/novel · https://github.com/udecode/plate/issues/4557
39. BlockNote releases (v0.42.0 → v0.56.0, mobile stack PR #2939/#3097) — https://github.com/TypeCellOS/BlockNote/releases · https://github.com/TypeCellOS/BlockNote/pull/3097
40. npm — `@tiptap/extension-unique-id` 3.32.0 (MIT) — https://registry.npmjs.org/@tiptap/extension-unique-id/latest
41. BlockNote — sorgente `packages/core/src/blocks/Image/block.ts` (props `caption`, `previewWidth`) — https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/src/blocks/Image/block.ts
42. npm registry — metadati completi `@tiptap/core` (timeline versioni: 3.32.0 del 13/10/2026, v2.27.3 del 04/09/2026, 75 release nell'ultimo anno) — https://registry.npmjs.org/@tiptap/core
