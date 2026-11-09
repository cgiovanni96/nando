import {
  ActionIcon,
  Box,
  Button,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import type { IconProps } from "@tabler/icons-react";
import {
  IconBook2,
  IconCalendarEvent,
  IconFolders,
  IconInbox,
  IconLayoutDashboard,
  IconMoon,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconSun,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";

type TablerIcon = ComponentType<IconProps>;

type NavEntry = {
  label: string;
  icon: TablerIcon;
  milestone?: string;
  to?: "/";
};

const primaryNav: NavEntry[] = [
  { label: "Dashboard", icon: IconLayoutDashboard, to: "/" },
  { label: "Calendario", icon: IconCalendarEvent, milestone: "M2" },
  { label: "Knowledge", icon: IconBook2, milestone: "M4" },
  { label: "Habits", icon: IconRepeat, milestone: "M5" },
];

const workspaceNav: NavEntry[] = [
  { label: "Inbox", icon: IconInbox, milestone: "M1" },
  { label: "Tutti gli Space", icon: IconFolders, milestone: "M1" },
];

function NavItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  const content = (
    <>
      <entry.icon className="nav-icon" size={18} stroke={1.6} />
      <span className="nav-label-text">{entry.label}</span>
      {entry.milestone ? <span className="nav-badge">{entry.milestone}</span> : null}
    </>
  );

  if (entry.to) {
    return (
      <Link
        to={entry.to}
        className={active ? "nav-item active" : "nav-item"}
        aria-current={active ? "page" : undefined}
        title={entry.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <Tooltip
      label={`${entry.label} — disponibile in ${entry.milestone}`}
      position="right"
      withArrow
    >
      <Box component="span" className="nav-item-wrap">
        <UnstyledButton
          className="nav-item"
          disabled
          aria-label={`${entry.label}, disponibile in ${entry.milestone}`}
          title={`${entry.label} — ${entry.milestone}`}
        >
          {content}
        </UnstyledButton>
      </Box>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const dark = computed === "dark";
  const label = dark ? "Passa al tema chiaro" : "Passa al tema scuro";

  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={label}
        onClick={() => setColorScheme(dark ? "light" : "dark")}
      >
        {dark ? <IconSun size={18} stroke={1.6} /> : <IconMoon size={18} stroke={1.6} />}
      </ActionIcon>
    </Tooltip>
  );
}

function BottomNavItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  const content = (
    <>
      <entry.icon size={20} stroke={1.6} />
      <span>{entry.label}</span>
    </>
  );

  if (entry.to) {
    return (
      <Link
        to={entry.to}
        className={active ? "bottom-nav-item active" : "bottom-nav-item"}
        aria-current={active ? "page" : undefined}
        title={entry.label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="bottom-nav-item"
      disabled
      aria-label={`${entry.label}, disponibile in ${entry.milestone}`}
      title={`${entry.label} — ${entry.milestone}`}
    >
      {content}
    </button>
  );
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Salta al contenuto
      </a>

      <aside className="sidebar" aria-label="Navigazione principale">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span className="brand-wordmark">Nando</span>
        </div>

        <UnstyledButton className="capture" disabled title="Cattura — disponibile in M1">
          <IconPlus size={16} stroke={1.6} />
          <span className="capture-label">Cattura</span>
        </UnstyledButton>

        <nav className="nav" aria-label="Sezioni">
          <div className="nav-group">
            <div className="nav-label">Navigazione</div>
            {primaryNav.map((entry) => (
              <NavItem key={entry.label} entry={entry} active={entry.to === pathname} />
            ))}
          </div>

          <div className="nav-group">
            <div className="nav-label">Spazio</div>
            {workspaceNav.map((entry) => (
              <NavItem key={entry.label} entry={entry} active={false} />
            ))}
          </div>
        </nav>

        <div className="side-bottom">
          <div className="user-row">
            <span className="user-monogram" aria-hidden="true">
              N
            </span>
            <span className="user-meta">
              <strong>Spazio personale</strong>
              <small>Owner</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Nando</span>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <span className="current">Dashboard</span>
          </div>

          <UnstyledButton
            className="top-search"
            disabled
            title="Ricerca — disponibile in M4b"
            aria-label="Ricerca, disponibile in M4b"
          >
            <IconSearch size={16} stroke={1.6} />
            <span>Cerca</span>
            <kbd>⌘K</kbd>
          </UnstyledButton>

          <ThemeToggle />

          <Button
            className="primary-action"
            leftSection={<IconPlus size={16} stroke={1.6} />}
            disabled
            title="Nuovo — disponibile in M1"
          >
            Nuovo
          </Button>

          <ActionIcon
            className="mobile-action"
            variant="subtle"
            color="gray"
            size="lg"
            disabled
            aria-label="Nuovo, disponibile in M1"
            title="Nuovo — disponibile in M1"
          >
            <IconPlus size={18} stroke={1.6} />
          </ActionIcon>
        </header>

        <main id="main-content" className="content">
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navigazione principale">
        {primaryNav.map((entry) => (
          <BottomNavItem key={entry.label} entry={entry} active={entry.to === pathname} />
        ))}
      </nav>
    </div>
  );
}
