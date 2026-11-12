# Architecture

This document is the working checklist for the shape of the repository. The decisions are in
[ADR-0010](../adr/0010-forma-del-repository-e-processi.md) (repository, processes, module boundaries),
[ADR-0003](../adr/0003-contratto-intermodulo.md) (module contract),
[ADR-0005](../adr/0005-core-capability-e-piattaforma.md) (core, capability, platform) and
[ADR-0021](../adr/0021-strategia-test-ci-ambienti.md) (tests).

## Scope

Read this before:

- adding a package, a module, or an adapter;
- adding or moving a route group under `apps/api/src/http`;
- adding a page, a shared component, or a server-only helper under `apps/web/src`;
- adding, moving, or importing a Drizzle schema;
- wiring database, job, storage, email, or AI dependencies.

## Workspace graph

```text
apps/web  ──type-only──▶  apps/api (AppType)
apps/api  ──▶  packages/core, packages/capability-*, packages/kernel, packages/platform
apps/worker ──▶  packages/core, packages/capability-*, packages/kernel, packages/platform
packages/capability-*  ──▶  packages/core, packages/kernel
packages/core  ──▶  packages/kernel
packages/kernel  ──▶  (nothing)
packages/platform  ──▶  packages/kernel
```

Rules:

- `apps/web` never touches the database and never imports `packages/platform`.
- `apps/api` is the only writer.
- `packages/core` does not depend on a capability; capabilities do not depend on each other.
- Each process has exactly one composition root.

## Package shape

```text
packages/<package>/src/
  index.ts                  public surface only
  <concept>/
    module.ts               create<Concept>Module(deps) -> { commands, queries, ports }
    commands.ts
    queries.ts
    ports.ts                interfaces only
    schema.ts               Drizzle tables owned by this package
    mapper.ts               domain <-> DTO or storage, when needed
    <concept>.test.ts       unit test, colocated
  test/integration/         integration test, per ADR-0021
```

Rules:

- `index.ts` is the only file another package may import. It re-exports the public surface; it
  never re-exports internals.
- `schema.ts` exists only in the package that owns the table. `packages/platform` re-exports it so
  the migration journal stays single.
- `ports.ts` contains interfaces, not implementations.
- `module.ts` receives narrow dependencies (`clock`, `ids`, `db`, `notifier`, `storage`,
  `aiGateway`) and returns `{ commands, queries, ports }`. No decorators, no reflection, no DI
  container.
- A module never imports another module's `commands.ts`, `queries.ts`, or `schema.ts` directly.

## API shape

```text
apps/api/src/
  index.ts                  entry and composition root: env, database, app, server, shutdown
  type.ts                   type-only entrypoint used by apps/web
  migrate.ts                one-shot migration entry
  http/
    app.ts                  Hono wiring, error envelope, docs
    errors.ts
    envelope.ts
    openapi.ts
    route-support.ts        validazione, response d'errore e router condivisi
    middleware/
    <group>/
      contract/
        index.ts            superficie pubblica: shared + operazioni
        shared.ts           schemi e DTO condivisi
      operations/
        <operation>/
          contract.ts       schemi, DTO, esempi, factory dell'operazione
          route.ts          describeRoute + validator + handler
      mapper.ts             domain -> DTO
      routes.ts             composizione + auth del gruppo
```

Un gruppo con una sola operazione può restare `contract.ts` + `routes.ts`.

Rules:

- `apps/api/src/index.ts` is the composition root. `http/` receives already-built dependencies.
- Routes never import `drizzle-orm` or `postgres`. They call commands and queries.
- `http/health.ts` is infrastructure, not a contract route: it may query the database and is
  excluded from the database ban.
- Wire shapes live only in `contract/` or in `operations/<operation>/contract.ts`. See
  [api-contract.md](api-contract.md).
- Shared route helpers live in `http/route-support.ts` (validators, command runner, error responses)
  and `http/openapi.ts` (response and request-body builders). `describeRoute` stays in the operation
  route.
- Integration tests live in `apps/api/test/integration/` and `safeParse` the documented response.

## Web shape

```text
apps/web/src/
  routes/                   TanStack file routes: data and wiring, no UI
  components/
    shared/                 what does not belong to a single page
      shell/
    pages/                  one folder per screen, mirroring the routes
      dashboard/
        dashboard-page.tsx
        dashboard-page.module.css
  lib/                      codice non-React: helper, client API, tema, i18n
    i18n/                   istanza, catalogo per locale, tipi delle chiavi
    router/                 route paths (from routeTree.gen.ts) and navigation config
  styles/                   CSS globale
  server/                   server-only: config, API client, proxy
  router.tsx
```

Rules:

- A route file declares data and wiring only: `loader`, `head`, `validateSearch`, `beforeLoad`,
  `server.handlers`, and `component` as a reference to an imported component. No JSX, no
  `*.module.css`, no `-prefixed` UI files under `routes/`. The only exception is `__root.tsx`, which
  owns the document, the provider and the shell.
- `errorComponent`, `pendingComponent` and `notFoundComponent` are imported references, never inline
  JSX.
- `components/pages/` owns the UI of a screen: one folder per screen, named after the route
  (`routes/$areaId` → `pages/area/`), with `<screen>-page.tsx` and `<screen>-page.module.css`.
- `components/shared/` owns what does not belong to a single page: the shell, plus components used
  across screens or general enough to have no single owner. A component used by a second page moves
  here; moving is not extraction, and ADR-0013 still forbids building generic components before the
  third occurrence.
- `lib/router/` owns route paths and the navigation config. `AppPath` comes from
  `routeTree.gen.ts`; components consume it and never hand-type a path. Navigation entries carry a
  `labelKey`, not a label.
- `lib/i18n/` owns the messages: one catalog per locale under `resources/`, the instance in
  `i18n.ts`, and the key types in `i18next.d.ts` (ADR-0026). Components call `t("...")` and never
  inline a user-facing string, including `aria-label`, `placeholder` and `title`;
  `react/jsx-no-literals` fails literal JSX text.
- `server/` is never imported from client code. The internal token never enters the browser bundle.
- The browser talks to `apps/api` through the same-origin `/api/*` proxy.

## Where things go

| Thing | Home |
| --- | --- |
| Domain concept | `packages/core/src/<concept>` |
| Capability | `packages/capability-<name>/src/<concept>` |
| Drizzle table | `schema.ts` in the package that owns it |
| Adapter (db, job, storage, email, AI) | `packages/platform/src/<port>` |
| HTTP route group | `apps/api/src/http/<group>` |
| UI route | `apps/web/src/routes` |
| UI of a screen | `apps/web/src/components/pages/<screen>` |
| Shell, cross-screen component | `apps/web/src/components/shared` |
| Route paths, navigation config | `apps/web/src/lib/router` |
| Testi dell'interfaccia | `apps/web/src/lib/i18n/resources/<locale>.ts` |
| Tema e default Mantine | `apps/web/src/lib/theme` |
| Browser-only helper | `apps/web/src/lib` |
| Server-only proxy or config | `apps/web/src/server` |
| Composition root | `apps/*/src/index.ts` |

## Boundary rules and how they are enforced

- The workspace graph enforces cross-package imports: pnpm does not resolve an undeclared
  dependency, so a forbidden import does not typecheck or build.
- `pnpm lint` enforces the rest through `.oxlintrc.json`:
  - `import/no-cycle`;
  - `no-restricted-imports` overrides for `web`, `api/http`, `kernel`, `core`, and capabilities;
  - `unicorn/filename-case` on `apps/web/src/**`: kebab-case, with `__root` and `$` route files
    ignored;
  - `typescript/no-explicit-any` and `typescript/consistent-type-imports`.
- TypeScript adds `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, and `noFallthroughCasesInSwitch`.
- Two rules are off on purpose: `react/react-in-jsx-scope` (React 19 uses the automatic JSX
  runtime) and `import/no-unassigned-import` (CSS and type-augmentation imports are side-effect
  imports in Vite and TanStack Start).
- Not automated yet: importing `packages/*/src/<internal>` from outside the package, and the
  `api/http -> packages/platform` rule. Add dependency-cruiser when the first real module lands.

## Adding a module

1. Pick the owning package: `core`, a capability, or `platform`.
2. Create `<concept>/` with `module.ts`, `commands.ts`, `queries.ts`, `ports.ts`, and `schema.ts`
   when the module owns tables.
3. Export only from `src/index.ts`.
4. Colocate unit tests next to the module; put integration tests under `test/integration/`.
5. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Adding a route group

1. Write the contract first: shared schemas in `contract/shared.ts`, then
   `operations/<operation>/contract.ts` with request schema, response schemas, DTO types, examples,
   factories; expose them through `contract/index.ts`.
2. Add `operations/<operation>/route.ts` with `describeRoute`, `validator`, and the shared schemas;
   compose it in `routes.ts`.
3. Add an integration test that `safeParse`s the response.
4. Use the route from `apps/web` in the same PR.
5. Run `pnpm typecheck`, `pnpm docs:check`, `pnpm test:integration`.

## Adding a package

1. Name it `@nando/<name>` and add only the workspace dependencies the graph allows.
2. Expose a public surface through `src/index.ts`.
3. Add unit and integration tests in the shapes above.
4. If the graph changes, update ADR-0010 and this document in the same PR.

## Naming

- All TypeScript files, React components included: kebab-case (`browser-api-client.ts`,
  `app-shell.tsx`). The component keeps PascalCase: `app-shell.tsx` exports `AppShell`.
- Page components: `<screen>-page.tsx` in `components/pages/<screen>/`, the folder named after the
  screen. `dashboard-page.tsx` exports `DashboardPage`.
- Files with a framework-mandated name are the only exception: `__root.tsx`, `$.ts`, `routeTree.gen.ts`.
- Unit tests: `<subject>.test.ts`, colocated.
- Integration tests: `test/integration/**/*.test.ts`, serial.
- Prefer named exports. Use a default export only where a tool requires it, such as Vite or Nitro
  configuration.

## Web styling

One file per component. A subcomponent stays in the same file only when it is tiny and presentational,
such as the item of a list; if it holds state, effects, or its own data, it gets its own file.

The order of preference, from first to last:

1. A Mantine component that already has the role: `AppShell`, `NavLink`, `Breadcrumbs`, `Kbd`,
   `Badge`, `Avatar`, `EmptyState`, `Group`, `Stack`, `Text`. Do not hand-build what the library
   ships, and do not use `Box` where `Group` or `Stack` expresses the layout.
2. Mantine props and style props for layout and theme keys (`gap`, `px`, `visibleFrom`, `m`, `fz`,
   `c="dimmed"`, `size="xs"`). Never a CSS variable in a prop: `bg="var(--nando-side)"` bypasses the
   theme and does not survive a refactor.
3. A `*.module.css` next to the component, for what props cannot express: bespoke typography, the
   active palette of a control, rail and mobile variants, pseudo-elements, complex responsive rules.
   Mantine CSS variables are used here, which is their documented home.
4. `apps/web/src/styles/global.css` only for resets, base elements, and cross-cutting policies
   (`:focus-visible`, reduced motion). A class that serves a single component never lives there.

Do not override a component's CSS variables with an inline `style`. Mantine exposes them from the
theme: `theme.components.<Component>.extend({ vars })`. Same for defaults that only need props:
`theme.components` is where a component-level change belongs, not the call site.

A one-off font or colour becomes a token: `theme.other.<name>` exposed by the resolver as
`--nando-<name>`, consumed by a module class. A second font family is an exception to the token ADR
and amends it in the same PR (ADR-0023, `brandFontFamily`).

Raw elements stay where they carry semantics (`nav`, `header`, `main`, `aside`) or where no Mantine
component exists; when Mantine has a polymorphic component, pass `component="nav"` instead of
writing the tag.

CSS modules are the Mantine-recommended styling approach: every Mantine component is styled with
them, and unscoped class names leak across the app. Global class names are not a shortcut for
"it is used in two places": extract the component, or add the class to both modules. A module lives
next to the component that consumes it, never under `routes/`: that folder holds no UI.

## What this is not

- No `packages/ui`, no Storybook, no design-system package (ADR-0023).
- No Turborepo in v1 (ADR-0010).
- No layer ceremony, no DI container, no shared composition root between processes.
- No second copy of wire shapes, DTOs, or migration schemas.

## Verification

```text
pnpm lint               oxlint + Prettier
pnpm typecheck          TypeScript across workspaces
pnpm test               unit tests, no Docker
pnpm test:integration   integration tests, needs Postgres
pnpm verify             the full gate before a PR
```
