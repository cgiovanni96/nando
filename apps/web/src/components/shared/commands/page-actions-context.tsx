import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

export type PageAction = {
  id: string;
  label: string;
  icon: ReactNode;
  color?: "red";
  disabled: boolean;
  /** Etichetta mostrata nello spotlight, per esempio `⌘S`. */
  shortcut?: string;
  onTrigger: () => void;
};

type PageActionsStore = {
  get: () => PageAction[];
  set: (actions: PageAction[]) => void;
  subscribe: (listener: () => void) => () => void;
};

function createPageActionsStore(): PageActionsStore {
  let actions: PageAction[] = [];
  const listeners = new Set<() => void>();

  return {
    get: () => actions,
    set: (next) => {
      actions = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const PageActionsContext = createContext<PageActionsStore | null>(null);

/**
 * Registro delle azioni della pagina corrente. Menu del task e spotlight
 * leggono lo stesso array, così le due superfici non divergono.
 */
export function PageActionsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [store] = useState(createPageActionsStore);

  return <PageActionsContext.Provider value={store}>{children}</PageActionsContext.Provider>;
}

function usePageActionsStore(): PageActionsStore {
  const store = useContext(PageActionsContext);
  if (!store) throw new Error("PageActionsProvider mancante.");
  return store;
}

export function usePageActions(): PageAction[] {
  const store = usePageActionsStore();

  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Registra le azioni finché il componente che le possiede resta montato. */
export function useRegisterPageActions(actions: PageAction[]): void {
  const store = usePageActionsStore();

  useEffect(() => {
    store.set(actions);
    return () => store.set([]);
  }, [store, actions]);
}
