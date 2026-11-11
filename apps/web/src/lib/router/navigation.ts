import type { IconProps } from "@tabler/icons-react";
import {
  IconBook2,
  IconCalendarEvent,
  IconFolders,
  IconInbox,
  IconLayoutDashboard,
  IconRepeat,
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

export const workspaceNav: NavEntry[] = [
  { labelKey: "nav.items.inbox", icon: IconInbox, milestone: "M1" },
  { labelKey: "nav.items.allSpaces", icon: IconFolders, milestone: "M1" },
];
