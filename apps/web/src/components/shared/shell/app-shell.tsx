import { AppShell as MantineAppShell, Box, Container } from "@mantine/core";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { QuickCaptureProvider } from "@web/components/shared/capture/quick-capture-provider";
import { CommandCenter } from "@web/components/shared/commands/command-center";
import { GlobalShortcuts } from "@web/components/shared/commands/global-shortcuts";
import { PageActionsProvider } from "@web/components/shared/commands/page-actions-context";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import classes from "./app-shell.module.css";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <PageActionsProvider>
      <QuickCaptureProvider>
        <CommandCenter />
        <GlobalShortcuts />

        <MantineAppShell
          layout="alt"
          padding={0}
          header={{ height: 56 }}
          navbar={{
            width: { base: 64, md: 248 },
            breakpoint: "sm",
            collapsed: { mobile: true },
          }}
        >
          <Box component="a" href="#main-content" className={classes.skipLink}>
            {t("app.skipToContent")}
          </Box>

          <AppSidebar pathname={pathname} />
          <AppHeader pathname={pathname} />

          <MantineAppShell.Main>
            <Container
              size="90rem"
              px={{ base: 20, sm: 40 }}
              pt={{ base: 24, sm: 40 }}
              pb={{ base: 96, sm: 64 }}
            >
              {children}
            </Container>
          </MantineAppShell.Main>

          <BottomNav pathname={pathname} />
        </MantineAppShell>
      </QuickCaptureProvider>
    </PageActionsProvider>
  );
}
