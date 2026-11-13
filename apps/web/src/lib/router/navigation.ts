import type { IconProps } from "@tabler/icons-react";
import {
  IconBook2,
  IconCalendarEvent,
  IconFolders,
  IconInbox,
  IconLayoutDashboard,
  IconRepeat,
  IconTrash,
} from "@tabler/icons-react";
import type { ParseKeysWithoutVariables } from "i18next";
import type { ComponentType } from "react";

import type { AppPath } from "./paths";

type TablerIcon = ComponentType<IconProps>;

/** A catalog key with no interpolation variables: the label is complete as it is. */
type NavLabelKey = ParseKeysWithoutVariables<"translation">;

type NavEntryBase = {
  labelKey: NavLabelKey;
  icon: TablerIcon;
};

/** A section that exists as a route. */
export type NavigableNavEntry = NavEntryBase & {
  to: AppPath;
};

/** A section that is planned but has no route yet. */
export type PlannedNavEntry = NavEntryBase & {
  milestone: string;
};

export type NavEntry = NavigableNavEntry | PlannedNavEntry;

export function isNavigable(entry: NavEntry): entry is NavigableNavEntry {
  return "to" in entry;
}

export const primaryNav: NavEntry[] = [
  { labelKey: "nav.items.dashboard", icon: IconLayoutDashboard, to: "/" },
  { labelKey: "nav.items.calendar", icon: IconCalendarEvent, milestone: "M2" },
  { labelKey: "nav.items.knowledge", icon: IconBook2, milestone: "M4" },
  { labelKey: "nav.items.habits", icon: IconRepeat, milestone: "M5" },
];

/** Inbox vive nella sezione workspace, ma è una destinazione anche su mobile. */
const inbox: NavigableNavEntry = { labelKey: "nav.items.inbox", icon: IconInbox, to: "/inbox" };

export const workspaceNav: NavEntry[] = [
  inbox,
  { labelKey: "nav.items.allSpaces", icon: IconFolders, milestone: "M2" },
];

/** Azioni di servizio, ancorate in fondo alla sidebar sopra la riga utente. */
export const utilityNav: NavEntry[] = [
  { labelKey: "nav.items.trash", icon: IconTrash, to: "/trash" },
];

/**
 * Barra mobile: le sezioni primarie più le destinazioni del workspace che
 * devono restare raggiungibili quando la sidebar è collassata.
 */
export const bottomNav: NavEntry[] = [...primaryNav, inbox];

/** Tutte le destinazioni navigabili, nell'ordine in cui compaiono. */
export const allNav: NavEntry[] = [...primaryNav, ...workspaceNav, ...utilityNav];

/**
 * Sezioni con sottopagine: la topbar mostra il nome della sezione quando il
 * path non è una voce di navigazione esatta (es. `/tasks/:id`).
 */
const DETAIL_SECTIONS: ReadonlyArray<{ prefix: string; labelKey: NavLabelKey }> = [
  { prefix: "/tasks/", labelKey: "nav.sections.task" },
];

/** Etichetta della sezione corrente per il breadcrumb della topbar. */
export function sectionLabelKey(pathname: string): NavLabelKey | null {
  const exact = allNav.find((entry) => isNavigable(entry) && entry.to === pathname);
  if (exact) return exact.labelKey;

  const detail = DETAIL_SECTIONS.find((section) => pathname.startsWith(section.prefix));
  return detail?.labelKey ?? null;
}
