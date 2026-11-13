import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

// Chiave interna di TanStack History, usata anche da `canGoBack`; non ha un tipo pubblico.
const STATE_INDEX_KEY = "__TSR_index"; // oxlint-disable-line eslint/no-underscore-dangle

function historyIndex(location: { state: unknown }): number {
  const state = location.state as Record<string, unknown> | null;
  const value = state?.[STATE_INDEX_KEY];

  return typeof value === "number" ? value : 0;
}

/** Struttura di `@tanstack/history`; esplicita perché in alcuni install se ne perde il tipo. */
type HistorySubscriberArgs = {
  location: { state: unknown };
  action: { type: string };
};

/**
 * Stato delle frecce indietro/avanti.
 *
 * `RouterHistory` espone solo `canGoBack()`: l'indice interno è l'unica
 * informazione disponibile per sapere se esiste una voce avanti. Una nuova
 * navigazione (PUSH/REPLACE) tronca la storia in avanti, un GO la conserva.
 */
export function useHistoryNavigation() {
  const router = useRouter();
  const index = historyIndex(router.history.location);
  const [maxIndex, setMaxIndex] = useState(index);

  useEffect(
    () =>
      router.history.subscribe((args: HistorySubscriberArgs) => {
        const next = historyIndex(args.location);

        if (args.action.type === "GO") {
          setMaxIndex((current) => Math.max(current, next));
          return;
        }

        setMaxIndex(next);
      }),
    [router],
  );

  return {
    canGoBack: router.history.canGoBack(),
    canGoForward: index < maxIndex,
    back: () => void router.history.back(),
    forward: () => void router.history.forward(),
  };
}
