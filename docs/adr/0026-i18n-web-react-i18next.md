# 0026 — i18n della web: react-i18next e un catalogo per locale

- **Stato:** accettato
- **Data:** 2026-11-10
- **Dipende da:** ADR-0010 (forma del repository e processi), ADR-0023 (shell e dashboard)
- **Chiarisce:** ADR-0010 (aggiunge `lib/i18n` alla forma della web e una regola ai testi)

## Contesto

Shell e dashboard avevano le etichette italiane scritte dentro i componenti: testo JSX, `aria-label`,
`title` e tooltip. Il risultato è che la stessa parola esiste in più file, che cambiare una frase è una
caccia al literal e che `aria-label` e tooltip possono divergere dal testo visibile.

Serve una libreria, non un file di costanti: la struttura deve già reggere una seconda lingua e
l'interpolazione. Oggi l'interfaccia ha un solo locale, l'italiano; non esistono selettore di lingua,
persistenza o rilevamento dal browser.

## Decisione

- **Libreria:** `i18next` con `react-i18next`. È runtime, quindi non aggiunge un passo di compilazione
  alla pipeline Vite/Nitro di TanStack Start; l'ecosistema è maturo e la tipizzazione delle chiavi si
  ottiene aumentando i tipi di `i18next`.
- **Catalogo:** `apps/web/src/lib/i18n/resources/it.ts` è l'albero dei messaggi, raggruppato per area
  (`app`, `comingSoon`, `nav`, `shell`, `dashboard`). `resources/index.ts` mappa locale → namespace →
  catalogo; `config.ts` elenca i locale supportati e dichiara `it` come default.
- **Istanza unica:** `lib/i18n/i18n.ts` crea l'istanza con le risorse inline, `lng: it`,
  `fallbackLng: it`, `returnNull: false` e `interpolation.escapeValue: false`. Con le risorse inline
  l'inizializzazione è sincrona: niente backend, niente suspense, niente attesa nella SSR.
- **Provider:** `I18nextProvider` sta in `__root.tsx`, l'unico file che possiede documento e provider
  (ADR-0010). Da lì vengono anche `<html lang>` e il `<title>`.
- **Tipi:** `lib/i18n/i18next.d.ts` aumenta `CustomTypeOptions` con il catalogo. Una chiave che non
  esiste non compila e le variabili di interpolazione sono obbligatorie. I dati di navigazione in
  `lib/router/navigation.ts` portano `labelKey` (un `ParseKeysWithoutVariables<"translation">`) invece
  della label.
- **Lint:** `react/jsx-no-literals` su `apps/web/src/**` fallisce sul testo JSX scritto a mano
  (`noStrings`). Le prop restano fuori (`ignoreProps`) perché la regola colpirebbe anche le prop di
  stile Mantine; `aria-label`, `title` e `placeholder` restano una responsabilità della review.
- **Aggiungere una lingua:** un file in `resources/`, una voce in `resources/index.ts` e in `locales`.
  I componenti non cambiano. Selettore, detection e persistenza entrano solo quando la seconda lingua
  esiste davvero.

## Invarianti

1. Nessun testo destinato all'utente vive in un componente: viene dal catalogo.
2. Un solo catalogo per locale; la stessa etichetta non è duplicata in più file.
3. Le voci di navigazione portano una chiave, non un testo.
4. Una chiave sbagliata o una variabile di interpolazione mancante non compila.
5. Il locale è uno solo finché non ne esiste un secondo: nessun selettore finto.

## Conseguenze

- **Componenti:** usano `useTranslation()` e `t("...")`; shell, navigazione, header, tema e dashboard
  non contengono più label italiane.
- **Build:** nessun plugin in più in `apps/web/vite.config.ts`.
- **Bundle:** il catalogo è un modulo statico, tree-shaken e senza fetch a runtime.
- **Tipi:** `t` è verificato a compile time; `ParseKeysWithoutVariables` impedisce di usare come label
  una chiave che richiede interpolazione.
- **Lint:** aggiungere testo in JSX ora è un errore, non una svista.
- **Costo:** nessuna estrazione automatica dei messaggi e nessun catalogo esterno da tradurre: quando
  arriverà una lingua, o si duplica il file a mano o si aggiunge una CLI.

## Alternative scartate

- **Costanti in un `labels.ts`:** nessuna interpolazione, nessuna pluralizzazione, nessun formato.
  Sarebbe un catalogo con meno garanzie di una libreria.
- **Paraglide:** messaggi compilati e tipizzati, ma aggiunge un plugin e un passo di generazione alla
  pipeline; con un solo locale il guadagno non copre il costo.
- **Lingui:** ICU e CLI di estrazione forti, ma richiede plugin Babel/SWC e un catalogo `.po` da
  compilare. Preferibile quando i traduttori sono esterni.
- **use-intl:** leggero e tipizzato, ma senza estrazione dei messaggi; la stessa funzione di
  `react-i18next` con meno ecosistema.
- **Testi nelle prop Mantine o in `theme`:** il tema è per i token, non per le stringhe (ADR-0023).

## Questioni aperte

- Date, numeri e durate: quando arriveranno i widget servono formatter `Intl` per locale, non solo
  stringhe.
- Plurale e genere: il catalogo è piatto; il primo caso reale deciderà se servono le forme i18next o
  un cambio di struttura.
- Se arriva una seconda lingua, detection e persistenza vanno decise insieme al selettore.
