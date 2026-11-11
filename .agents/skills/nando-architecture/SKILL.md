---
name: nando-architecture
description: Use when adding, moving, or wiring a package, module, route group, adapter, or screen in Nando, or when deciding where code belongs. Enforces docs/agents/architecture.md and ADR-0010.
---

# Nando architecture

Read `docs/agents/architecture.md` first. The decisions are ADR-0010 (workspace, processes, module
boundaries), ADR-0003 (module contract), ADR-0005 (core/capability/platform), and ADR-0021 (tests).
When a request contradicts one of them, name the ADR and explain the conflict before writing code.

## Dependency direction

```text
apps/web  ──type-only──▶  apps/api
apps/api  ──▶  core, capability-*, kernel, platform
apps/worker ──▶  core, capability-*, kernel, platform
capability-*  ──▶  core, kernel
core  ──▶  kernel
kernel  ──▶  nothing
platform  ──▶  kernel
```

- `web` never imports `platform` and never touches the database.
- `api` is the only writer.
- `core` does not depend on a capability; capabilities do not depend on each other.
- One composition root per process: `apps/*/src/index.ts`.

## Where code goes

| Thing                        | Home                                       |
| ---------------------------- | ------------------------------------------ |
| Domain concept               | `packages/core/src/<concept>`              |
| Capability                   | `packages/capability-<name>/src/<concept>` |
| Drizzle table                | `schema.ts` in the package that owns it    |
| Adapter                      | `packages/platform/src/<port>`             |
| HTTP route group             | `apps/api/src/http/<group>`                |
| UI route                     | `apps/web/src/routes`                      |
| Shell, widget, capability UI | `apps/web/src/components`                  |
| Route paths, navigation      | `apps/web/src/lib/router`                  |
| Browser-only helper          | `apps/web/src/lib`                         |
| Server-only proxy or config  | `apps/web/src/server`                      |

## Module shape

```text
packages/<package>/src/<concept>/
  module.ts        create<Concept>Module(deps) -> { commands, queries, ports }
  commands.ts
  queries.ts
  ports.ts         interfaces only
  schema.ts        only if this package owns tables
  mapper.ts        when a mapping is needed
  <concept>.test.ts
```

- `src/index.ts` is the public surface. Another package imports only that file.
- `module.ts` takes narrow deps (`clock`, `ids`, `db`, `notifier`, `storage`, `aiGateway`). No
  decorators, no reflection, no DI container.
- `ports.ts` has no implementations.
- A module never imports another module's `commands.ts`, `queries.ts`, or `schema.ts` directly.

## Web files and styling

- Every TypeScript file is kebab-case, React components included: `app-shell.tsx` exports
  `AppShell`. `__root.tsx`, `$.ts` and `routeTree.gen.ts` are framework names and stay as they are.
- Route paths and navigation config live in `apps/web/src/lib/router`. `AppPath` comes from
  `routeTree.gen.ts`; never hand-type a path in a component.
- One file per component. A subcomponent stays only when it is tiny and presentational (a list
  item); state, effects or data mean a separate file.
- Prefer the Mantine component for the role (`AppShell`, `NavLink`, `Breadcrumbs`, `Kbd`, `Badge`,
  `Avatar`, `EmptyState`, `Group`, `Stack`, `Text`) over hand-written markup. Keep raw `nav`,
  `header`, `main`, `aside` only for the semantics they carry.
- Style props only for layout and theme keys (`gap`, `px`, `visibleFrom`, `fz`, `c="dimmed"`). Never
  `var(--…)` in a prop.
- Component CSS variables belong in the theme: `theme.components.<C>.extend({ vars })`, not an
  inline `style`.
- `*.module.css` next to the component for bespoke typography, active palettes and responsive
  variants. `apps/web/src/styles/global.css` holds resets, base elements and cross-cutting policies
  only: never a class for a single component.
- A one-off font or colour is a token (`theme.other` + `--nando-<name>`). A second font family
  amends the token ADR in the same PR.
- `pnpm lint` enforces `unicorn/filename-case` on `apps/web/src/**`.

## Boundaries are checked

- `pnpm lint` runs `import/no-cycle`, the `no-restricted-imports` overrides in `.oxlintrc.json`, and
  `typescript/no-explicit-any`.
- `apps/api/src/http/health.ts` is infrastructure: the database ban excludes it.
- `pnpm typecheck` is strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- The workspace graph blocks undeclared cross-package imports at resolution time.

If a rule blocks a legitimate import, change the architecture or the rule in the same PR; do not add
an inline disable without a comment that explains why.

## Checklist

1. Pick the owning package before creating files.
2. Add `schema.ts` only in the package that owns the table.
3. Export only from `src/index.ts`.
4. Unit tests stay next to the module; integration tests go under `test/integration/`.
5. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
6. If the dependency graph changed, update ADR-0010 and `docs/agents/architecture.md`.
