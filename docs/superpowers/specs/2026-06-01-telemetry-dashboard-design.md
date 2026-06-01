# Telemetry Dashboard — Design Spec

**Date:** 2026-06-01
**Status:** Approved (brainstorm)
**Source of truth for game schema and PostHog facts:** `handoff.md` at repo root.

## 1. Goal

A public, live analytics site over PostHog game-telemetry, with a clickable
drill-down flow (matches → match detail → player history) and balance views
(powerup pick-rate). Free to host. The PostHog read key must never reach the
browser. SQL is never accepted from the client.

## 2. Architecture

```
┌──────────────────────────────────────────────┐
│ GitHub Pages: https://<user>.github.io/...   │
│  React + Vite + TanStack Router + Query      │
│  /matches  /matches/:id  /players/:id        │
│  /balance/powerups                           │
└──────────────────┬───────────────────────────┘
                   │ fetch(), JSON, CORS-locked
                   ▼
┌──────────────────────────────────────────────┐
│ Cloudflare Worker: pgc-telemetry-proxy       │
│  Thin router → endpoint modules              │
│   /matches  /match  /player  /powerup-pickrate│
│   /maps  /versions                           │
│  Holds POSTHOG_API_KEY. 60s edge cache.      │
└──────────────────┬───────────────────────────┘
                   │ POST /query/  Bearer phx_…
                   ▼
              PostHog Cloud (EU)
```

### 2.1 Repo layout (monorepo, pnpm workspace)

```
telemetry-dashboard/
├── package.json                  # workspace root
├── pnpm-workspace.yaml
├── proxy/                        # Cloudflare Worker
├── site/                         # React frontend
├── packages/shared/              # API types
├── docs/superpowers/specs/       # this file
└── .github/workflows/
    ├── deploy-proxy.yml
    └── deploy-site.yml
```

Two path-filtered workflows. Both `proxy` and `site` depend on
`@pgc/shared` via workspace resolution.

## 3. Backend: Cloudflare Worker (`proxy/`)

### 3.1 Layout

```
proxy/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # router + CORS + error wrapping + cache wrapping
│   ├── posthog.ts            # runQuery(env, sql, values) → typed rows
│   ├── cache.ts              # cacheJson(request, ttl, handler) using Cache API
│   ├── cors.ts               # withCors(response, origin)
│   ├── validate.ts           # validators + allowlist cache
│   └── endpoints/
│       ├── matches.ts
│       ├── match.ts
│       ├── player.ts
│       ├── powerup-pickrate.ts
│       ├── maps.ts
│       └── versions.ts
└── test/                     # Vitest + @cloudflare/vitest-pool-workers
```

### 3.2 Request lifecycle

`index.ts` does, in order:

1. Preflight: if `OPTIONS`, return CORS preflight headers and exit.
2. Match `pathname` against a static route map → endpoint handler.
3. Validate query params (`validate.ts`). On failure: `400 { error, field }`.
4. Build Cache API key from method+URL. If hit → return cached `Response`.
5. Endpoint handler calls `posthog.runQuery(env, SQL, values)`.
6. Wrap response with CORS + `Cache-Control: public, max-age=<ttl>`;
   `caches.default.put` before returning.
7. Any thrown error → log to Worker logs, return `500 { error: "internal" }`.
   **Never leak PostHog error bodies or the key.**

### 3.3 Endpoint contract

All endpoints respond with `ApiEnvelope<T>` (success) or `ApiError` (failure).
Types live in `packages/shared/types.ts`:

```ts
type ApiEnvelope<T> = { data: T; generated_at: string };
type ApiError = { error: string; field?: string };

type TimeRange = { since?: string; until?: string }; // ISO8601, default last 30d

// GET /matches?since&until&map&version
type MatchesRequest = TimeRange & { map?: string; version?: string };
type Match = {
  match_id: string; started_at: string; map: string;
  rounds: number; players: number; max_players: number;
  round_duration_s: number; version: string;
};
type MatchesResponse = { matches: Match[] };

// GET /match?id=<match_id>
type MatchDetail = {
  overview: { map: string; rounds: number; players: number; max_players: number;
              round_s: number; version: string; } | null;
  scoreboard: { player_id: string; kills: number; deaths: number; points: number; }[];
};

// GET /player?id=<player_id>
type PlayerHistory = {
  matches: { match_id: string; played_at: string; rounds_seen: number; }[];
};

// GET /powerup-pickrate?since&until
type PowerupPickrate = {
  rows: { powerup: string; times_offered: number; times_picked: number; pick_rate: number; }[];
};

// GET /maps?since&until    → { maps: string[] }
// GET /versions            → { versions: string[] }
```

### 3.4 SQL

Base SQL is taken from `handoff.md` §"Endpoint menu (v1)". Optional filters are
appended conditionally; every user-supplied value goes through `{name}`
placeholders in the `values` object.

Example `/matches`:

```sql
SELECT
    properties.match_id             AS match_id,
    timestamp                       AS started_at,
    properties.map_name             AS map,
    properties.total_rounds         AS rounds,
    properties.player_count         AS players,
    properties.max_players          AS max_players,
    properties.round_duration_secs  AS round_duration_s,
    properties.game_version         AS version
FROM events
WHERE event = 'match_started'
  AND timestamp >= {since}
  AND timestamp <  {until}
  -- appended conditionally:
  AND properties.map_name     = {map}
  AND properties.game_version = {version}
ORDER BY started_at DESC
LIMIT 500
```

Defaults: `since = now() - INTERVAL 30 DAY`, `until = now()`.
Hard `LIMIT 500` on every list endpoint as a backstop.

`/powerup-pickrate` keeps the tested SQL from `handoff.md` (with the
`ifNull(toString(...), '[]')` workaround around `JSONExtractArrayRaw` — do not
regress this).

### 3.5 Validation rules (`validate.ts`)

- `match_id`, `player_id`: regex `^[A-Za-z0-9_-]{1,128}$`.
- `since`, `until`: must parse as ISO 8601 and resolve within the last 2 years.
- `map`, `version`: must be a member of the corresponding allowlist. The
  allowlist is populated by running the same SQL that powers the `/maps` and
  `/versions` endpoints (`SELECT DISTINCT properties.map_name FROM events …`,
  `SELECT DISTINCT properties.game_version …`), cached in-Worker for 5
  minutes via a shared helper. Anything outside the allowlist → `400`. The
  `/maps` and `/versions` HTTP endpoints reuse this same helper so the
  validator and the dropdown source share one cached source of truth.
- Defaults applied after validation: if `since`/`until` missing, fall back to
  last 30 days.

### 3.6 Cache + rate limit

- **Edge cache:** default `Cache-Control: public, max-age=60` via Cloudflare
  Cache API. Per-endpoint override allowed; only `/match` may want shorter
  (15s) in a later iteration — v1 ships uniform 60s.
- **Rate limit:** Cloudflare WAF rule, 60 req/min per IP, configured in the CF
  dashboard. No in-Worker code for this.

### 3.7 CORS

- `ALLOWED_ORIGIN` is a non-secret Worker var in `wrangler.toml`, set to the
  exact Pages origin (e.g. `https://<user>.github.io`). Never `*`.
- Both `OPTIONS` preflight and actual responses set the same origin and
  `Vary: Origin`.

### 3.8 Configuration

`wrangler.toml`:

```toml
name = "pgc-telemetry-proxy"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[vars]
ALLOWED_ORIGIN = "https://<user>.github.io"
```

Secret: `POSTHOG_API_KEY` (scoped `phx_` key: read-only, project 189316,
`query` resource only). Uploaded by the deploy workflow on every push.

## 4. Frontend: GitHub Pages (`site/`)

### 4.1 Stack

React + Vite + TypeScript. TanStack Router (code-based, typed search params).
TanStack Query for caching/loading. Tailwind CSS. No chart lib in v1.

### 4.2 Layout

```
site/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/favicon.svg
└── src/
    ├── main.tsx                  # React root, QueryClient, RouterProvider
    ├── router.tsx                # TanStack Router tree
    ├── api/
    │   ├── client.ts             # fetch wrapper, base URL, error normalization
    │   └── queries.ts            # useQuery hook per endpoint
    ├── routes/
    │   ├── __root.tsx
    │   ├── index.tsx             # redirects to /matches
    │   ├── matches.tsx
    │   ├── matches.$id.tsx
    │   ├── players.$id.tsx
    │   └── balance.powerups.tsx
    ├── components/
    │   ├── DataTable.tsx
    │   ├── TimeRangePicker.tsx
    │   ├── FilterBar.tsx
    │   ├── LoadingState.tsx
    │   ├── ErrorState.tsx
    │   └── EmptyState.tsx
    ├── lib/
    │   ├── format.ts
    │   └── config.ts
    └── styles.css
```

### 4.3 Routes

| Path | Loads | Notes |
|---|---|---|
| `/` | — | Redirects to `/matches`. |
| `/matches` | `useMatchesQuery(filters)` | Filters in URL search params (typed). |
| `/matches/$id` | `useMatchQuery(id)` | Scoreboard rows → `/players/$id`. |
| `/players/$id` | `usePlayerHistoryQuery(id)` | Match rows → `/matches/$id`. |
| `/balance/powerups` | `usePowerupPickrateQuery(filters)` | Sortable table. |

### 4.4 Data layer

`api/client.ts`:

```ts
export async function api<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, import.meta.env.VITE_API_BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new ApiError(await res.json().catch(() => ({ error: "network" })), res.status);
  const env = await res.json() as ApiEnvelope<T>;
  return env.data;
}
```

`api/queries.ts` — one hook per endpoint, `staleTime: 60_000` to mirror Worker
cache and avoid thundering refetches.

### 4.5 UI

- Tailwind, single dark theme. Token set: background, surface, border, text,
  accent, muted.
- `DataTable`: in-repo generic sortable/filterable table (~150 lines).
  Per-column declaration. Row click handler for navigation. TanStack Table is
  the upgrade path once we need virtualization or column resizing.
- Page footer shows "Updated <relative-time>" from envelope `generated_at`.

### 4.6 Configuration

- Build-time: `VITE_API_BASE_URL` baked into `site/dist` (public URL — safe
  to commit `.env.production` if convenient).
- Dev: `.env.development` points at `http://127.0.0.1:8787` (`wrangler dev`).

## 5. Shared types package (`packages/shared/`)

A tiny package with one job: export the request/response types listed in §3.3.

```
packages/shared/
├── package.json    # name: "@pgc/shared", main: "src/index.ts"
├── tsconfig.json
└── src/index.ts    # re-exports from types.ts
└── src/types.ts
```

Imported as `@pgc/shared` by both `proxy` and `site`. No build step — both
consumers tsc the source directly. If PostHog response shapes start
surprising us, the natural upgrade is to add Zod schemas here and validate
at the runtime boundaries.

## 6. Error handling matrix

| Case | Worker | UI |
|---|---|---|
| Bad query param | `400 { error, field }` | Inline message on offending filter; rest of page unaffected. |
| PostHog 5xx / timeout | Log full error; return `502 { error: "upstream" }`. | `<ErrorState>` with TanStack Query retry. |
| PostHog 0 rows | `200` with empty array. | `<EmptyState>` per page. |
| Network / CORS / unknown | (thrown in `api()`) | `<ErrorState>` with message. |
| Required field missing | `400`. | Router guards ensure `/matches/$id` won't render without id. |

## 7. Security checklist (non-negotiable)

1. The Worker has no path that accepts SQL from the client. All SQL is
   hardcoded in `endpoints/*.ts`.
2. Every user-supplied value flows through `posthog.runQuery(env, sql, values)`;
   `values` is a plain object. SQL templates use `{name}` placeholders. No
   string concatenation of user input into SQL anywhere.
3. CORS is single exact origin from `ALLOWED_ORIGIN` env var. Never `*`.
4. `POSTHOG_API_KEY` is imported only in `posthog.ts`. Error path returns
   generic `{ error: "internal" }` and logs upstream body to Worker logs
   only.
5. `validate.ts` allowlists for `map`/`version` are populated from
   `/maps`/`/versions`; non-allowlisted values → `400`. This keeps even
   placeholder-bound values constrained to known-good strings.

## 8. Testing

- **Worker:** Vitest + `@cloudflare/vitest-pool-workers`. One file per
  endpoint covering happy path, validator rejection, and upstream-error
  mapping. PostHog HTTP is mocked (msw or simple fetch stub).
- **Shared:** `tsc --noEmit` in CI.
- **Frontend:** Vitest + React Testing Library. Coverage focus:
  `DataTable` sort/filter, navigation flow (matches → match → player →
  match), filter URL round-trip. MSW stubs the Worker. No E2E in v1.

## 9. Deployment

### 9.1 `.github/workflows/deploy-proxy.yml`

Trigger: push to `main` touching `proxy/**` or `packages/shared/**`.

Steps:
1. Checkout, setup Node + pnpm, `pnpm install`.
2. `pnpm --filter @pgc/proxy test`.
3. `pnpm --filter @pgc/proxy typecheck`.
4. `cloudflare/wrangler-action@v3` with `workingDirectory: proxy`,
   `secrets: POSTHOG_API_KEY`, env from repo secrets.

### 9.2 `.github/workflows/deploy-site.yml`

Trigger: push to `main` touching `site/**` or `packages/shared/**`.

Steps:
1. Checkout, setup Node + pnpm, `pnpm install`.
2. `pnpm --filter @pgc/site test && typecheck && build`. Build reads
   `VITE_API_BASE_URL` from repo variable.
3. `actions/upload-pages-artifact` + `actions/deploy-pages` publishes
   `site/dist`.

Pages settings: GitHub Pages source = "GitHub Actions" (not branch).

### 9.3 Required GitHub repo configuration

- Secret: `CLOUDFLARE_API_TOKEN` (permission template: Edit Cloudflare Workers).
- Secret: `CLOUDFLARE_ACCOUNT_ID`.
- Secret: `POSTHOG_API_KEY` (new scoped `phx_` read-only key for project 189316).
- Variable: `VITE_API_BASE_URL` (set after first Worker deploy, then rerun
  the site workflow).

## 10. v1 scope summary

In:
- 4 list/detail endpoints + 2 dropdown endpoints (`maps`, `versions`).
- Time range / map / version filters in URL search params.
- Matches list, match detail (overview + scoreboard), player history,
  powerup pick-rate.
- Clickable navigation matches ↔ match ↔ player.
- Single dark theme. Sortable tables. No charts.
- Auto-deploy both surfaces from `main`.

Out (deferred, intentionally):
- Auth/login, write operations, PostHog Groups (paid).
- Charts.
- Light theme.
- Round-by-round timelines, per-match deep dives beyond scoreboard.
- Player lifetime aggregates (lifetime kills/deaths/points/best class).
- Historical pre-aggregation.
- Multi-region.
- E2E tests.

## 11. Upgrade paths (noted, not built)

- **Hono on the Worker** once endpoint count grows past ~6 or middleware
  composition gets repetitive.
- **Zod in `@pgc/shared`** when PostHog response shape stability becomes a
  concern.
- **TanStack Table** when `DataTable` needs virtualization or column
  resize/reorder.
- **Recharts/Chart.js** when balance views grow beyond tables.
- **Per-endpoint cache TTLs** if uniform 60s starts feeling stale on
  match detail.
