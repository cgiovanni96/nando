import { Drawer, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { QuickCaptureForm } from "./quick-capture-form";

type QuickCaptureContextValue = {
  opened: boolean;
  open: () => void;
  close: () => void;
};

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

/**
 * Una sola cattura per tutta l'app: modale su desktop, drawer dal basso su
 * mobile. La aprono i bottoni della topbar, `n n` e l'azione dello spotlight.
 */
export function QuickCaptureProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const value = useMemo(
    () => ({
      opened,
      open: () => setOpened(true),
      close: () => setOpened(false),
    }),
    [opened],
  );

  const form = <QuickCaptureForm layout="compact" autoFocus onCreated={() => setOpened(false)} />;

  return (
    <QuickCaptureContext.Provider value={value}>
      {children}

      {isMobile ? (
        <Drawer
          opened={opened}
          onClose={() => setOpened(false)}
          position="bottom"
          size={360}
          radius="xl"
          padding="xl"
          title={t("capture.title")}
        >
          {form}
        </Drawer>
      ) : (
        <Modal
          opened={opened}
          onClose={() => setOpened(false)}
          size="md"
          title={t("capture.title")}
        >
          {form}
        </Modal>
      )}
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCaptureModal(): QuickCaptureContextValue {
  const value = useContext(QuickCaptureContext);
  if (!value) throw new Error("QuickCaptureProvider mancante.");
  return value;
}
