# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before you start any task

**Check what's installed and use it.** Before diving in, take stock of available tools — skills, MCP servers, plugins — and reach for the ones that fit the task. Don't reinvent functionality that a tool already provides.

**Serena MCP is mandatory in this repo.**
- If the Serena MCP server is not available, reachable, or activated for this project: **stop work immediately** and tell the user. Do not proceed with any code changes. Wait for the user to activate or fix Serena.
- When Serena is available, follow its setup: call its `initial_instructions` tool first, then `list_memories` / `read_memory` to surface any prior context relevant to the task. Past Serena memories are the canonical source of "what was decided", "what burned us", and "what's planned" — read before acting.
- **All persistent memory writes go through Serena, not through other memory systems.** Serena's memories live under the project (typically `.serena/memories/`) and are committed and pushed to git, so they're shared across machines and agents. Anything saved elsewhere (e.g., the host-local file-based auto-memory under `~/.claude/projects/...`) is invisible to other contributors and other machines — do not use those paths for project memory.
- Save a memory via Serena when you learn something that another agent on this repo would benefit from knowing: a non-obvious decision, a footgun you hit, a quirk you worked around, a user preference, where an external resource lives. Don't save things derivable from the current code, recent commits, or this CLAUDE.md.

## Project overview

Live public analytics dashboard over PostHog game telemetry. Two deployed surfaces backed by a single pnpm workspace:

- **`proxy/`** — Cloudflare Worker. Holds the PostHog read key (`POSTHOG_API_KEY` env secret) and exposes a fixed menu of 6 endpoints that run hardcoded HogQL against PostHog's EU Query API. Live at `https://pgc-telemetry-proxy.zwazel.workers.dev`.
- **`site/`** — React + Vite SPA deployed to GitHub Pages at `https://zwazel-games.github.io/pgc-telemetry-dashboard/`. Uses **hash routing** (`#/matches`, `#/players/:id`, etc.) — see "Hash routing" note below.
- **`packages/shared/`** — TypeScript request/response types consumed by both via workspace aliasing.

Source of truth documents:
- `docs/superpowers/specs/2026-06-01-telemetry-dashboard-design.md` — the design spec
- `docs/superpowers/plans/2026-06-01-telemetry-dashboard.md` — the implementation plan
- `handoff.md` — PostHog facts (project ID, EU host, event schema, HogQL quirks); the SQL gotchas section is non-negotiable

## Non-negotiable architecture rules

**The Worker is NOT a SQL passthrough.** Every endpoint's HogQL lives as a module-level `const SQL = \`...\`` constant in `proxy/src/endpoints/<name>.ts`. The client never sends SQL — only validated parameters. To add a new endpoint, add a new file under `proxy/src/endpoints/`, hardcode its SQL there, and register it in the `routes` map in `proxy/src/index.ts`.

The one exception is a **structurally-identical endpoint family**: `proxy/src/endpoints/pick-analytics.ts` serves the `*_picked` events (powerup/class/weapon) from shared SQL builders that interpolate only the hardcoded PostHog event name — never user input — so the no-passthrough guarantee still holds. To add a new pick entity, add one `{ path, event }` entry to its `PICK_ENTITIES` table; the `/<entity>` and `/<entity>-pickrate` routes are generated and spread into `index.ts`. Don't hand-copy a new endpoint file for it.

**User-supplied values flow through HogQL `{name}` placeholders only.** Pass them via the `values` object to `runQuery()` in `proxy/src/posthog.ts` — never string-concatenate into SQL. For datetime comparisons, wrap the placeholder: `timestamp >= toDateTime({since})`. String-typed placeholders won't auto-coerce to `DateTime` and the query will fail.

**The 500 error path returns a hardcoded generic message.** Never reflect `UpstreamError.message`, `err.body`, or upstream HTTP bodies to the client. The router in `proxy/src/index.ts` catches everything and returns `{ error: "internal" }`. There is a regression test in `proxy/test/index.test.ts` ("does not leak upstream") that exists to prevent this.

**CORS is exact-origin allowlisting, never `*`.** The Worker's `env.ALLOWED_ORIGIN` is a comma-separated list. `pickOrigin()` in `proxy/src/index.ts` matches the request's `Origin` header against the list and echoes the matched value. To add a new origin (e.g., staging frontend), append to `[vars].ALLOWED_ORIGIN` in `proxy/wrangler.toml`.

## Common commands

All commands run from the repo root unless noted. The workspace uses pnpm 9 (declared in root `package.json` as `packageManager`).

```bash
# Install everything
pnpm install

# Test / typecheck / build (fan-out across all packages)
pnpm test
pnpm typecheck
pnpm build

# Worker (proxy/)
pnpm --filter @pgc/proxy test                       # runs in Miniflare via @cloudflare/vitest-pool-workers
pnpm --filter @pgc/proxy test -- <pattern>          # filter to a single file/test
pnpm --filter @pgc/proxy typecheck
pnpm --filter @pgc/proxy dev                        # wrangler dev on http://127.0.0.1:8787
pnpm --filter @pgc/proxy deploy                     # manual deploy (CI does this on push)

# Site (site/)
pnpm --filter @pgc/site dev                         # vite on http://localhost:5173
pnpm --filter @pgc/site test
pnpm --filter @pgc/site test -- <pattern>
pnpm --filter @pgc/site typecheck
pnpm --filter @pgc/site build

# Shared types (typecheck only — no runtime)
pnpm --filter @pgc/shared typecheck
```

For local end-to-end dev: run `pnpm --filter @pgc/proxy dev` AND `pnpm --filter @pgc/site dev` in parallel. The site's `API_BASE_URL` (`site/src/lib/config.ts`) defaults to `http://127.0.0.1:8787` when `VITE_API_BASE_URL` isn't set, and the Worker's CORS allowlist includes `http://localhost:5173`.

For local Worker secret: `POSTHOG_API_KEY` is set as a CI secret in production, but for `wrangler dev` you'll need it locally — `wrangler secret put POSTHOG_API_KEY` or a `.dev.vars` file (gitignored).

## Deployment

Two path-filtered GitHub Actions workflows in `.github/workflows/`:

- **`deploy-proxy.yml`** triggers on push to `main` touching `proxy/**`, `packages/shared/**`, `pnpm-lock.yaml`, or itself. Runs typecheck + test, then `wrangler deploy`. Uploads `POSTHOG_API_KEY` as a Worker secret on every deploy.
- **`deploy-site.yml`** triggers on push to `main` touching `site/**`, `packages/shared/**`, `pnpm-lock.yaml`, or itself. Runs typecheck + test + build, then uses `actions/upload-pages-artifact` + `actions/deploy-pages`.

Both workflows pin **Node 22** (Wrangler 4 requires it) and let `pnpm/action-setup@v4` read the pnpm version from root `package.json` (do NOT pass `version:` — it conflicts with `packageManager`).

### Required GitHub secrets (Settings → Secrets → Actions)
- `CLOUDFLARE_API_TOKEN` — "Edit Cloudflare Workers" template, account-scoped
- `CLOUDFLARE_ACCOUNT_ID`
- `POSTHOG_API_KEY` — scoped read-only `phx_` key for project 189316, `query:read` only

### Required GitHub variable (Settings → Variables → Actions)
- `VITE_API_BASE_URL = https://pgc-telemetry-proxy.zwazel.workers.dev`
  This **must** be in the Variables tab, not Secrets. The site workflow reads `${{ vars.VITE_API_BASE_URL }}`; putting it in Secrets makes it resolve to empty and the production build silently calls `localhost:8787`. Easy to misdiagnose later as a CORS or network issue.

### Required Cloudflare setup (one-time)
First deploy of a fresh account requires enabling the Worker URL toggle in the Cloudflare dashboard (Workers & Pages → pgc-telemetry-proxy → Settings → Domains & Routes → Worker URL → toggle on). Without this, deploys upload the script but the public URL is inactive.

## Code patterns to follow

### Endpoints (proxy/src/endpoints/*.ts)
Every endpoint is a separate file exporting `handle(req, env, ctx): Promise<Response>` and follows the same shape:

```ts
export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    // 1. validate params (throws ApiHttpError on bad input)
    // 2. runQuery<RowType>(env, SQL, values)
    // 3. build ApiEnvelope<ResponseShape> with generated_at: new Date().toISOString()
    // 4. return jsonResponse(body, 200, CACHE_S)
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;  // bubbles to router → generic 500
  }
}
```

Don't refactor *divergent* endpoints into a shared wrapper — `/matches`, `/match`, `/player` etc. diverge as filters/joins grow, and the per-file duplication there is intentional. But a **structurally-identical family** (same query shape, differing only by a constant) IS factored: see `pick-analytics.ts`, which builds the powerup/class/weapon pickrate + detail handlers from one set of SQL builders. Use that judgement — copy when endpoints will diverge, share when they're the same query modulo a hardcoded parameter.

### Validation
`proxy/src/validate.ts` exports three validators (`validateId`, `validateTimeRange`, `validateAllowlisted`). The `map` and `version` allowlists come from cached `/maps`/`/versions` results via `proxy/src/distincts.ts` — call `getMaps(env)` / `getVersions(env)` to fetch the lists, then pass to `validateAllowlisted`.

### Frontend routes (site/src/routes/*.tsx)
Each route co-locates the page component AND the `Route = createRoute({...})` definition. Routes with filters use `validateSearch` to type the URL search params. The standard render shape:

```tsx
{q.isPending && <LoadingState />}
{q.isError && <ErrorState message={...} onRetry={() => q.refetch()} />}
{q.data && (<>
  <DataTable<RowType> columns={...} rows={...} getRowKey={...} />
  <UpdatedAt iso={q.data.generated_at} />
</>)}
```

`DataTable` handles its own empty state via the `emptyMessage` prop. Don't add separate `<EmptyState>` blocks around it.

### Query hooks (site/src/api/queries.ts)
Add a new hook with `useQuery({ queryKey, queryFn: () => apiEnvelope<T>(...), staleTime: 60_000 })`. The `staleTime` mirrors the Worker's 60s cache TTL — don't lower it without lowering the Worker's `CACHE_S` too, or you'll get unnecessary refetches that the Cache API will just serve from cache anyway.

## Quirks that have already burned us

- **HogQL datetime placeholders need `toDateTime()`.** Bare `timestamp >= {since}` returns 500 with a type-mismatch from PostHog (which the Worker correctly hides behind generic "internal"). Both `/matches` and `/powerup-pickrate` use the cast. See `proxy/src/endpoints/matches.ts:24` for the pattern.
- **TanStack Router v1 code-based routing has a type-inference cycle.** Any `<Link to="...">`, `redirect({ to: ... })`, or `navigate({ to, params })` needs `as any` casts on the `to` and `params` props. ~10 such casts in `site/src/routes/`, all with `eslint-disable-next-line` comments and one explanatory `TODO(typing)` in `__root.tsx`. The proper fix is migrating to file-based routing (`@tanstack/router-vite-plugin` + generated `routeTree.gen.ts`); not in scope for v1.
- **Hash routing on the site.** `site/src/router.tsx` uses `createHashHistory()` so deep-link reloads (`/#/players/p_xxx`) work without 404.html tricks or Pages-specific config, and genuine bad paths still get GitHub's real 404. URLs include a `#` — that's intentional, not a bug.
- **Vite `base` is set only for `command === "build"`.** Production assets load from `/pgc-telemetry-dashboard/assets/*`; dev serves from `/`. See `site/vite.config.ts`. This is independent of routing.
- **`exactOptionalPropertyTypes` is scoped to `packages/shared/tsconfig.json` only**, not the base config. Enabling it base-wide breaks TanStack Router/Query type patterns in the frontend. The shared package gets the strict optional semantics because it defines the API wire contract.
- **`cache.test.ts` uses real `createExecutionContext()` + `waitOnExecutionContext()` from `cloudflare:test`**, not a `vi.fn()` mock. A mocked `waitUntil` silently drops the `cache.put` microtask and the test would falsely appear to pass without ever populating the cache.

## Workspace tsconfig

- `tsconfig.base.json` at the repo root — shared strict flags (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, etc.). No `rootDir` (it breaks workspace path mappings).
- All cross-file relative imports must end in `.js` extension (required by `verbatimModuleSyntax` + bundler-mode resolution). Example: `import { foo } from "./bar.js"` even when `bar.ts` is the source file. The compiler resolves this correctly.
- Cross-package imports use `@pgc/shared` path alias declared in `proxy/tsconfig.json` and `site/tsconfig.json`.
