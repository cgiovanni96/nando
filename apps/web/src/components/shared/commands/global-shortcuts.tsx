import { spotlight } from "@mantine/spotlight";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useQuickCaptureModal } from "@web/components/shared/capture/quick-capture-provider";
import {
  isInsideDialog,
  isTypingTarget,
  nextLeaderCommand,
  type LeaderState,
} from "@web/lib/commands/leader";
import { useHistoryNavigation } from "@web/lib/router/history";
import { usePageActions } from "./page-actions-context";

/**
 * Unico proprietario delle scorciatoie globali.
 *
 * - `⌘K` funziona sempre, anche nei campi e sopra le modali.
 * - `⌘S` usa l'azione Salva registrata dalla pagina.
 * - `n n`, `n d`, `n i`, `n t` e `?` ignorano campi di testo e dialoghi.
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const { canGoBack, canGoForward, back, forward } = useHistoryNavigation();
  const { open: openCapture } = useQuickCaptureModal();
  const pageActions = usePageActions();
  const leader = useRef<LeaderState>(null);
  const actions = useRef(pageActions);

  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const lastPathname = useRef(pathname);

  useEffect(() => {
    actions.current = pageActions;
  }, [pageActions]);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    leader.current = null;
  }, [pathname]);

  useEffect(() => {
    function resetLeader() {
      leader.current = null;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;

      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      if (mod && !event.altKey && key === "k") {
        event.preventDefault();
        resetLeader();
        spotlight.toggle();
        return;
      }

      if (mod && !event.altKey && key === "s") {
        event.preventDefault();
        if (isInsideDialog(event.target)) return;
        actions.current.find((action) => action.id === "save")?.onTrigger();
        return;
      }

      if (mod && !event.altKey && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        if (isInsideDialog(event.target)) return;
        if (event.key === "[") {
          if (canGoBack) back();
        } else if (canGoForward) {
          forward();
        }
        return;
      }

      if (isTypingTarget(event.target) || isInsideDialog(event.target)) {
        resetLeader();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        resetLeader();
        spotlight.open();
        return;
      }

      if (mod || event.altKey || event.shiftKey) {
        resetLeader();
        return;
      }

      const result = nextLeaderCommand(leader.current, key, Date.now());
      leader.current = result.state;

      if (!result.command) return;

      event.preventDefault();

      switch (result.command) {
        case "capture":
          openCapture();
          return;
        case "dashboard":
          void navigate({ to: "/" });
          return;
        case "inbox":
          void navigate({ to: "/inbox" });
          return;
        case "trash":
          void navigate({ to: "/trash" });
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", resetLeader);
    window.addEventListener("pointerdown", resetLeader);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", resetLeader);
      window.removeEventListener("pointerdown", resetLeader);
    };
  }, [back, canGoBack, canGoForward, forward, navigate, openCapture]);

  return null;
}
