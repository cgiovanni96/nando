import type { IconProps } from "@tabler/icons-react";
import {
  IconBook2,
  IconCalendarEvent,
  IconFolders,
  IconInbox,
  IconLayoutDashboard,
  IconRepeat,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

import type { AppPath } from "./paths";

type TablerIcon = ComponentType<IconProps>;

type NavEntryBase = {
  label: string;
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
  { label: "Dashboard", icon: IconLayoutDashboard, to: "/" },
  { label: "Calendario", icon: IconCalendarEvent, milestone: "M2" },
  { label: "Knowledge", icon: IconBook2, milestone: "M4" },
  { label: "Habits", icon: IconRepeat, milestone: "M5" },
];

export const workspaceNav: NavEntry[] = [
  { label: "Inbox", icon: IconInbox, milestone: "M1" },
  { label: "Tutti gli Space", icon: IconFolders, milestone: "M1" },
];
