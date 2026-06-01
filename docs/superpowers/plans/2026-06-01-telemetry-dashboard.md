# Telemetry Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, live PostHog analytics site over game telemetry — a Cloudflare Worker BFF that holds the PostHog key and serves a fixed endpoint menu, plus a React + Vite GitHub Pages frontend with clickable drill-down (matches → match → player) and balance views.

**Architecture:** Monorepo (pnpm workspaces). `proxy/` is a Cloudflare Worker holding `POSTHOG_API_KEY`; SQL is hardcoded per endpoint. `site/` is a React + TypeScript SPA deployed to GitHub Pages. `packages/shared/` exports request/response TS types consumed by both. Two GitHub Actions workflows auto-deploy on push to `main`. No SQL ever crosses the network from the client.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest (both surfaces), Cloudflare Wrangler 4, `@cloudflare/vitest-pool-workers`, React 19, Vite 6, TanStack Router, TanStack Query, Tailwind CSS, MSW (frontend test stubs).

**Spec:** `docs/superpowers/specs/2026-06-01-telemetry-dashboard-design.md`

**Prerequisites (already done per user):**
- Cloudflare account exists; `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` available to set as GitHub repo secrets.
- New scoped read-only `phx_` PostHog API key created for project 189316 — to be set as repo secret `POSTHOG_API_KEY`.
- Git repo initialized (done in brainstorming wrap-up).

---

## File Structure (locked-in decomposition)

```
telemetry-dashboard/
├── package.json                  # workspace root, no prod deps
├── pnpm-workspace.yaml
├── tsconfig.base.json            # shared TS config
├── .gitignore                    # already exists
├── .github/workflows/
│   ├── deploy-proxy.yml
│   └── deploy-site.yml
├── docs/superpowers/             # spec + plan live here
├── handoff.md
├── packages/shared/
│   ├── package.json              # @pgc/shared
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # barrel
│       └── types.ts              # API contract: requests, responses, envelopes
├── proxy/
│   ├── package.json              # @pgc/proxy
│   ├── wrangler.toml
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts              # router + lifecycle
│   │   ├── env.ts                # Env type
│   │   ├── posthog.ts            # runQuery(env, sql, values)
│   │   ├── cors.ts               # withCors, preflight
│   │   ├── cache.ts              # cacheJson
│   │   ├── errors.ts             # ApiHttpError, toJsonError
│   │   ├── validate.ts           # id/time/allowlist validators
│   │   ├── distincts.ts          # shared cached helper for maps + versions
│   │   └── endpoints/
│   │       ├── matches.ts
│   │       ├── match.ts
│   │       ├── player.ts
│   │       ├── powerup-pickrate.ts
│   │       ├── maps.ts
│   │       └── versions.ts
│   └── test/                     # mirrors src/
└── site/
    ├── package.json              # @pgc/site
    ├── tsconfig.json
    ├── vite.config.ts
    ├── vitest.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html
    ├── public/favicon.svg
    └── src/
        ├── main.tsx
        ├── router.tsx            # TanStack Router tree
        ├── styles.css            # Tailwind entry + dark tokens
        ├── api/
        │   ├── client.ts
        │   └── queries.ts
        ├── lib/
        │   ├── config.ts         # VITE_API_BASE_URL
        │   └── format.ts         # dates/durations/percentages
        ├── components/
        │   ├── DataTable.tsx
        │   ├── TimeRangePicker.tsx
        │   ├── FilterBar.tsx
        │   ├── LoadingState.tsx
        │   ├── ErrorState.tsx
        │   ├── EmptyState.tsx
        │   └── UpdatedAt.tsx
        └── routes/
            ├── __root.tsx
            ├── index.tsx
            ├── matches.tsx
            ├── matches.$id.tsx
            ├── players.$id.tsx
            └── balance.powerups.tsx
```

---

## Task 1: Workspace scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'proxy'
  - 'site'
  - 'packages/*'
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "telemetry-dashboard",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Verify pnpm workspace recognizes layout**

Run: `pnpm install`
Expected: succeeds with "Done in …s", creates `node_modules` and `pnpm-lock.yaml` (empty workspace at this point is fine).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspace"
```

---

## Task 2: Shared types package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@pgc/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts` with the full API contract**

```ts
// Wire envelope
export type ApiEnvelope<T> = { data: T; generated_at: string };
export type ApiError = { error: string; field?: string };

// Filters
export type TimeRange = { since?: string; until?: string };

// /matches
export type MatchesRequest = TimeRange & { map?: string; version?: string };
export type Match = {
  match_id: string;
  started_at: string;
  map: string;
  rounds: number;
  players: number;
  max_players: number;
  round_duration_s: number;
  version: string;
};
export type MatchesResponse = { matches: Match[] };

// /match?id=
export type MatchOverview = {
  map: string;
  rounds: number;
  players: number;
  max_players: number;
  round_s: number;
  version: string;
};
export type ScoreboardRow = {
  player_id: string;
  kills: number;
  deaths: number;
  points: number;
};
export type MatchDetail = {
  overview: MatchOverview | null;
  scoreboard: ScoreboardRow[];
};

// /player?id=
export type PlayerMatchRow = {
  match_id: string;
  played_at: string;
  rounds_seen: number;
};
export type PlayerHistory = { matches: PlayerMatchRow[] };

// /powerup-pickrate
export type PowerupPickrateRow = {
  powerup: string;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PowerupPickrate = { rows: PowerupPickrateRow[] };

// /maps, /versions
export type MapsResponse = { maps: string[] };
export type VersionsResponse = { versions: string[] };
```

- [ ] **Step 4: Create barrel `packages/shared/src/index.ts`**

```ts
export * from "./types.js";
```

- [ ] **Step 5: Install + typecheck**

Run: `pnpm install && pnpm --filter @pgc/shared typecheck`
Expected: install succeeds; typecheck passes with no output.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add API contract types"
```

---

## Task 3: Proxy scaffold (Worker package, no logic yet)

**Files:**
- Create: `proxy/package.json`
- Create: `proxy/wrangler.toml`
- Create: `proxy/tsconfig.json`
- Create: `proxy/vitest.config.ts`
- Create: `proxy/src/env.ts`
- Create: `proxy/src/index.ts`
- Create: `proxy/test/smoke.test.ts`

- [ ] **Step 1: Create `proxy/package.json`**

```json
{
  "name": "@pgc/proxy",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pgc/shared": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20250101.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `proxy/wrangler.toml`**

```toml
name = "pgc-telemetry-proxy"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ALLOWED_ORIGIN = "http://localhost:5173"

# POSTHOG_API_KEY is set as a secret via GitHub Actions (or `wrangler secret put` locally)
```

- [ ] **Step 3: Create `proxy/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "noEmit": true,
    "rootDir": ".",
    "paths": {
      "@pgc/shared": ["../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 4: Create `proxy/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            ALLOWED_ORIGIN: "http://localhost:5173",
            POSTHOG_API_KEY: "test-key",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 5: Create `proxy/src/env.ts`**

```ts
export type Env = {
  POSTHOG_API_KEY: string;
  ALLOWED_ORIGIN: string;
};
```

- [ ] **Step 6: Write the failing smoke test `proxy/test/smoke.test.ts`**

```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("404s on unknown route", async () => {
    const res = await SELF.fetch("https://example.com/unknown");
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 7: Create minimal `proxy/src/index.ts`**

```ts
import type { Env } from "./env.js";

export default {
  async fetch(_req: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 8: Install + run test**

Run: `pnpm install && pnpm --filter @pgc/proxy test`
Expected: 1 test passes.

- [ ] **Step 9: Commit**

```bash
git add proxy pnpm-lock.yaml
git commit -m "feat(proxy): scaffold worker with 404 fallback"
```

---

## Task 4: PostHog client (`proxy/src/posthog.ts`)

**Files:**
- Create: `proxy/src/posthog.ts`
- Create: `proxy/test/posthog.test.ts`

- [ ] **Step 1: Write the failing test `proxy/test/posthog.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runQuery } from "../src/posthog.js";

const fakeEnv = { POSTHOG_API_KEY: "phx_test", ALLOWED_ORIGIN: "x" };

describe("runQuery", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the EU query endpoint with bearer auth and parameterized HogQL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["a", 1]], columns: ["x", "y"] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await runQuery<{ x: string; y: number }>(fakeEnv, "SELECT * WHERE id = {id}", { id: "abc" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://eu.posthog.com/api/projects/189316/query/");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer phx_test",
      "content-type": "application/json",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: { kind: "HogQLQuery", query: "SELECT * WHERE id = {id}", values: { id: "abc" } },
    });
    expect(rows).toEqual([{ x: "a", y: 1 }]);
  });

  it("throws UpstreamError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    await expect(runQuery(fakeEnv, "SELECT 1", {})).rejects.toThrow(/upstream/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pgc/proxy test`
Expected: FAIL — "Cannot find module '../src/posthog.js'".

- [ ] **Step 3: Implement `proxy/src/posthog.ts`**

```ts
import type { Env } from "./env.js";

const PROJECT_ID = 189316;
const HOST = "https://eu.posthog.com";

export class UpstreamError extends Error {
  constructor(public status: number, body: string) {
    super(`upstream ${status}: ${body.slice(0, 200)}`);
  }
}

export async function runQuery<TRow>(
  env: Env,
  sql: string,
  values: Record<string, string | number>,
): Promise<TRow[]> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.POSTHOG_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: sql, values },
    }),
  });
  if (!res.ok) {
    throw new UpstreamError(res.status, await res.text().catch(() => ""));
  }
  const json = (await res.json()) as { results: unknown[][]; columns: string[] };
  return json.results.map((row) => {
    const obj: Record<string, unknown> = {};
    json.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as TRow;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pgc/proxy test`
Expected: 3 tests pass (smoke + 2 new).

- [ ] **Step 5: Commit**

```bash
git add proxy/src/posthog.ts proxy/test/posthog.test.ts
git commit -m "feat(proxy): add PostHog HogQL client"
```

---

## Task 5: CORS helper

**Files:**
- Create: `proxy/src/cors.ts`
- Create: `proxy/test/cors.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/cors.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { preflight, withCors } from "../src/cors.js";

describe("cors", () => {
  it("preflight returns 204 with allow headers", () => {
    const res = preflight("https://site.example");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("withCors adds allow-origin header", () => {
    const res = withCors(new Response("ok"), "https://site.example");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect(res.headers.get("vary")).toBe("Origin");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pgc/proxy test -- cors`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/cors.ts`**

```ts
const COMMON_HEADERS: HeadersInit = {
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
};

export function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: { ...COMMON_HEADERS, "access-control-allow-origin": origin },
  });
}

export function withCors(res: Response, origin: string): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pgc/proxy test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/cors.ts proxy/test/cors.test.ts
git commit -m "feat(proxy): add CORS helpers"
```

---

## Task 6: Errors + JSON helper

**Files:**
- Create: `proxy/src/errors.ts`
- Create: `proxy/test/errors.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/errors.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ApiHttpError, jsonResponse } from "../src/errors.js";

describe("errors", () => {
  it("ApiHttpError carries status and body", () => {
    const e = new ApiHttpError(400, { error: "bad", field: "id" });
    expect(e.status).toBe(400);
    expect(e.body).toEqual({ error: "bad", field: "id" });
  });

  it("jsonResponse sets content-type and serializes envelope", async () => {
    const res = jsonResponse({ data: { x: 1 }, generated_at: "2026-01-01T00:00:00Z" }, 200, 60);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await res.json()).toEqual({ data: { x: 1 }, generated_at: "2026-01-01T00:00:00Z" });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- errors`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/errors.ts`**

```ts
import type { ApiError } from "@pgc/shared";

export class ApiHttpError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.error);
  }
}

export function jsonResponse(body: unknown, status: number, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

export function jsonError(err: ApiError, status: number): Response {
  return jsonResponse(err, status, 0);
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/errors.ts proxy/test/errors.test.ts
git commit -m "feat(proxy): add typed errors and json response helper"
```

---

## Task 7: Edge cache helper

**Files:**
- Create: `proxy/src/cache.ts`
- Create: `proxy/test/cache.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/cache.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { cacheJson } from "../src/cache.js";

describe("cacheJson", () => {
  it("calls handler on first hit, returns cached response on second", async () => {
    const url = "https://x.test/matches?since=A";
    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    const handler = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: 1 }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
        }),
      ),
    );

    const first = await cacheJson(new Request(url), ctx, handler);
    expect(first.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();

    const second = await cacheJson(new Request(url), ctx, handler);
    expect(second.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/cache.ts`**

```ts
export async function cacheJson(
  req: Request,
  ctx: ExecutionContext,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (req.method !== "GET") return handler();

  const cache = caches.default;
  const cacheKey = new Request(req.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const res = await handler();
  if (res.ok) {
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/cache.ts proxy/test/cache.test.ts
git commit -m "feat(proxy): add edge cache helper"
```

---

## Task 8: Cached distincts (maps + versions source)

**Files:**
- Create: `proxy/src/distincts.ts`
- Create: `proxy/test/distincts.test.ts`

This is the shared helper that powers both the `/maps`/`/versions` HTTP endpoints AND the validator allowlist for `map`/`version` params on `/matches`. It caches in-memory (Worker isolate scope) for 5 minutes.

- [ ] **Step 1: Write failing test `proxy/test/distincts.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMaps, getVersions, _resetDistinctsCacheForTests } from "../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };

describe("distincts", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("getMaps returns map_name list, cached on second call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["arena_a"], ["arena_b"]], columns: ["map_name"] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getMaps(env)).toEqual(["arena_a", "arena_b"]);
    expect(await getMaps(env)).toEqual(["arena_a", "arena_b"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("getVersions returns version list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["1.0.0"], ["1.0.1"]], columns: ["game_version"] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getVersions(env)).toEqual(["1.0.0", "1.0.1"]);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- distincts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/distincts.ts`**

```ts
import type { Env } from "./env.js";
import { runQuery } from "./posthog.js";

const TTL_MS = 5 * 60_000;

type Cached<T> = { value: T; at: number };
let mapsCache: Cached<string[]> | null = null;
let versionsCache: Cached<string[]> | null = null;

const MAPS_SQL = `
SELECT DISTINCT properties.map_name AS map_name
FROM events
WHERE event = 'match_started' AND notEmpty(toString(properties.map_name))
ORDER BY map_name
`;

const VERSIONS_SQL = `
SELECT DISTINCT properties.game_version AS game_version
FROM events
WHERE event = 'match_started' AND notEmpty(toString(properties.game_version))
ORDER BY game_version DESC
`;

export async function getMaps(env: Env): Promise<string[]> {
  if (mapsCache && Date.now() - mapsCache.at < TTL_MS) return mapsCache.value;
  const rows = await runQuery<{ map_name: string }>(env, MAPS_SQL, {});
  const value = rows.map((r) => r.map_name);
  mapsCache = { value, at: Date.now() };
  return value;
}

export async function getVersions(env: Env): Promise<string[]> {
  if (versionsCache && Date.now() - versionsCache.at < TTL_MS) return versionsCache.value;
  const rows = await runQuery<{ game_version: string }>(env, VERSIONS_SQL, {});
  const value = rows.map((r) => r.game_version);
  versionsCache = { value, at: Date.now() };
  return value;
}

export function _resetDistinctsCacheForTests(): void {
  mapsCache = null;
  versionsCache = null;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/distincts.ts proxy/test/distincts.test.ts
git commit -m "feat(proxy): add cached distincts helper for maps + versions"
```

---

## Task 9: Validators

**Files:**
- Create: `proxy/src/validate.ts`
- Create: `proxy/test/validate.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/validate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateId, validateTimeRange, validateAllowlisted } from "../src/validate.js";
import { ApiHttpError } from "../src/errors.js";

describe("validate", () => {
  describe("validateId", () => {
    it("accepts a safe id", () => {
      expect(validateId("abc_123-XYZ", "match_id")).toBe("abc_123-XYZ");
    });
    it("rejects empty", () => {
      expect(() => validateId("", "match_id")).toThrow(ApiHttpError);
    });
    it("rejects characters outside A-Z 0-9 _ -", () => {
      expect(() => validateId("ab cd", "match_id")).toThrow(ApiHttpError);
      expect(() => validateId("ab;DROP", "match_id")).toThrow(ApiHttpError);
    });
    it("rejects > 128 chars", () => {
      expect(() => validateId("a".repeat(129), "match_id")).toThrow(ApiHttpError);
    });
  });

  describe("validateTimeRange", () => {
    it("defaults to last 30 days when both missing", () => {
      const { since, until } = validateTimeRange(undefined, undefined);
      expect(new Date(until).getTime() - new Date(since).getTime())
        .toBeGreaterThan(29 * 86_400_000);
    });
    it("rejects unparseable ISO", () => {
      expect(() => validateTimeRange("not-a-date", undefined)).toThrow(ApiHttpError);
    });
    it("rejects > 2 years old", () => {
      expect(() => validateTimeRange("2000-01-01T00:00:00Z", undefined)).toThrow(ApiHttpError);
    });
  });

  describe("validateAllowlisted", () => {
    it("returns undefined when value missing", () => {
      expect(validateAllowlisted(undefined, ["a"], "map")).toBeUndefined();
    });
    it("returns value when present in allowlist", () => {
      expect(validateAllowlisted("a", ["a", "b"], "map")).toBe("a");
    });
    it("throws when not in allowlist", () => {
      expect(() => validateAllowlisted("c", ["a", "b"], "map")).toThrow(ApiHttpError);
    });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- validate`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/validate.ts`**

```ts
import { ApiHttpError } from "./errors.js";

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TWO_YEARS_MS = 2 * 365 * 86_400_000;

export function validateId(value: string | undefined, field: string): string {
  if (!value || !ID_RE.test(value)) {
    throw new ApiHttpError(400, { error: "invalid id", field });
  }
  return value;
}

export function validateTimeRange(
  since: string | undefined,
  until: string | undefined,
): { since: string; until: string } {
  const now = Date.now();
  const defaultSince = new Date(now - 30 * 86_400_000).toISOString();
  const defaultUntil = new Date(now).toISOString();

  const sinceIso = since ?? defaultSince;
  const untilIso = until ?? defaultUntil;

  const sinceTs = Date.parse(sinceIso);
  const untilTs = Date.parse(untilIso);
  if (Number.isNaN(sinceTs)) throw new ApiHttpError(400, { error: "invalid since", field: "since" });
  if (Number.isNaN(untilTs)) throw new ApiHttpError(400, { error: "invalid until", field: "until" });
  if (now - sinceTs > TWO_YEARS_MS) throw new ApiHttpError(400, { error: "since too old", field: "since" });
  if (untilTs < sinceTs) throw new ApiHttpError(400, { error: "until before since", field: "until" });

  return { since: new Date(sinceTs).toISOString(), until: new Date(untilTs).toISOString() };
}

export function validateAllowlisted<T extends string>(
  value: string | undefined,
  allowlist: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === "") return undefined;
  if (!allowlist.includes(value as T)) {
    throw new ApiHttpError(400, { error: "value not allowed", field });
  }
  return value as T;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/validate.ts proxy/test/validate.test.ts
git commit -m "feat(proxy): add input validators"
```

---

## Task 10: Endpoints — `/maps` and `/versions`

**Files:**
- Create: `proxy/src/endpoints/maps.ts`
- Create: `proxy/src/endpoints/versions.ts`
- Create: `proxy/test/endpoints/maps.test.ts`
- Create: `proxy/test/endpoints/versions.test.ts`

Each endpoint exports a `handle(req, env, ctx)` that returns a `Response` with `ApiEnvelope<MapsResponse>` / `ApiEnvelope<VersionsResponse>`.

- [ ] **Step 1: Write failing test `proxy/test/endpoints/maps.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/maps.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /maps", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("returns envelope with maps array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["arena_a"], ["arena_b"]], columns: ["map_name"] })),
    ));
    const res = await handle(new Request("https://x.test/maps"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { maps: string[] }; generated_at: string };
    expect(json.data.maps).toEqual(["arena_a", "arena_b"]);
    expect(typeof json.generated_at).toBe("string");
  });
});
```

- [ ] **Step 2: Write failing test `proxy/test/endpoints/versions.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/versions.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /versions", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("returns envelope with versions array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["1.0.1"], ["1.0.0"]], columns: ["game_version"] })),
    ));
    const res = await handle(new Request("https://x.test/versions"), env, ctx);
    const json = await res.json() as { data: { versions: string[] } };
    expect(json.data.versions).toEqual(["1.0.1", "1.0.0"]);
  });
});
```

- [ ] **Step 3: Run tests, verify both fail**

Run: `pnpm --filter @pgc/proxy test -- endpoints`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `proxy/src/endpoints/maps.ts`**

```ts
import type { MapsResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { getMaps } from "../distincts.js";
import { jsonResponse } from "../errors.js";

const CACHE_S = 60;

export async function handle(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const maps = await getMaps(env);
  const body: { data: MapsResponse; generated_at: string } = {
    data: { maps },
    generated_at: new Date().toISOString(),
  };
  return jsonResponse(body, 200, CACHE_S);
}
```

- [ ] **Step 5: Implement `proxy/src/endpoints/versions.ts`**

```ts
import type { VersionsResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { getVersions } from "../distincts.js";
import { jsonResponse } from "../errors.js";

const CACHE_S = 60;

export async function handle(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const versions = await getVersions(env);
  const body: { data: VersionsResponse; generated_at: string } = {
    data: { versions },
    generated_at: new Date().toISOString(),
  };
  return jsonResponse(body, 200, CACHE_S);
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add proxy/src/endpoints/maps.ts proxy/src/endpoints/versions.ts proxy/test/endpoints
git commit -m "feat(proxy): add /maps and /versions endpoints"
```

---

## Task 11: Endpoint — `/matches`

**Files:**
- Create: `proxy/src/endpoints/matches.ts`
- Create: `proxy/test/endpoints/matches.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/endpoints/matches.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/matches.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

function stubDistincts(): void {
  // First two fetches in this test are for distincts; subsequent ones serve the /matches query.
  const responses = [
    new Response(JSON.stringify({ results: [["arena_a"]], columns: ["map_name"] })),
    new Response(JSON.stringify({ results: [["1.0.0"]], columns: ["game_version"] })),
  ];
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift() ?? new Response("{}"))));
}

describe("GET /matches", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("rejects map not in allowlist", async () => {
    stubDistincts();
    const res = await handle(new Request("https://x.test/matches?map=unknown"), env, ctx);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; field?: string };
    expect(json.field).toBe("map");
  });

  it("returns envelope with matches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [["arena_a"]], columns: ["map_name"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [["1.0.0"]], columns: ["game_version"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["m1", "2026-05-01T00:00:00Z", "arena_a", 5, 4, 8, 60, "1.0.0"]],
        columns: ["match_id", "started_at", "map", "rounds", "players", "max_players", "round_duration_s", "version"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/matches"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { matches: { match_id: string }[] } };
    expect(json.data.matches[0]?.match_id).toBe("m1");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- matches`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `proxy/src/endpoints/matches.ts`**

```ts
import type { Match, MatchesResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { getMaps, getVersions } from "../distincts.js";
import { validateTimeRange, validateAllowlisted } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;
const LIMIT = 500;

const BASE = `
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
`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { since, until } = validateTimeRange(url.searchParams.get("since") ?? undefined, url.searchParams.get("until") ?? undefined);
    const [maps, versions] = await Promise.all([getMaps(env), getVersions(env)]);
    const map = validateAllowlisted(url.searchParams.get("map") ?? undefined, maps, "map");
    const version = validateAllowlisted(url.searchParams.get("version") ?? undefined, versions, "version");

    let sql = BASE;
    const values: Record<string, string | number> = { since, until };
    if (map !== undefined)     { sql += "  AND properties.map_name     = {map}\n";     values.map = map; }
    if (version !== undefined) { sql += "  AND properties.game_version = {version}\n"; values.version = version; }
    sql += `ORDER BY started_at DESC LIMIT ${LIMIT}`;

    const rows = await runQuery<Match>(env, sql, values);
    const body: { data: MatchesResponse; generated_at: string } = {
      data: { matches: rows },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/endpoints/matches.ts proxy/test/endpoints/matches.test.ts
git commit -m "feat(proxy): add /matches endpoint with filters"
```

---

## Task 12: Endpoint — `/match?id=`

**Files:**
- Create: `proxy/src/endpoints/match.ts`
- Create: `proxy/test/endpoints/match.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/endpoints/match.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/match.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /match", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/match"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("400 when id contains illegal chars", async () => {
    const res = await handle(new Request("https://x.test/match?id=hi+there"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns overview + scoreboard", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["arena_a", 5, 4, 8, 60, "1.0.0"]],
        columns: ["map", "rounds", "players", "max_players", "round_s", "version"],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["p1", 10, 4, 200]],
        columns: ["player_id", "kills", "deaths", "points"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/match?id=m1"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { overview: { map: string } | null; scoreboard: { player_id: string }[] } };
    expect(json.data.overview?.map).toBe("arena_a");
    expect(json.data.scoreboard[0]?.player_id).toBe("p1");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- "endpoints/match"`
Expected: FAIL.

- [ ] **Step 3: Implement `proxy/src/endpoints/match.ts`**

```ts
import type { MatchDetail, MatchOverview, ScoreboardRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

const OVERVIEW_SQL = `
SELECT properties.map_name AS map, properties.total_rounds AS rounds,
       properties.player_count AS players, properties.max_players AS max_players,
       properties.round_duration_secs AS round_s, properties.game_version AS version
FROM events
WHERE event = 'match_started' AND properties.match_id = {match_id}
LIMIT 1
`;

const SCOREBOARD_SQL = `
SELECT properties.player_id           AS player_id,
       sum(properties.kills)          AS kills,
       sum(properties.deaths)         AS deaths,
       sum(properties.points_awarded) AS points
FROM events
WHERE event = 'player_round_summary' AND properties.match_id = {match_id}
GROUP BY player_id
ORDER BY points DESC
LIMIT 500
`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = validateId(url.searchParams.get("id") ?? undefined, "id");
    const values = { match_id: id };
    const [overviewRows, scoreboard] = await Promise.all([
      runQuery<MatchOverview>(env, OVERVIEW_SQL, values),
      runQuery<ScoreboardRow>(env, SCOREBOARD_SQL, values),
    ]);
    const body: { data: MatchDetail; generated_at: string } = {
      data: { overview: overviewRows[0] ?? null, scoreboard },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/endpoints/match.ts proxy/test/endpoints/match.test.ts
git commit -m "feat(proxy): add /match endpoint"
```

---

## Task 13: Endpoint — `/player?id=`

**Files:**
- Create: `proxy/src/endpoints/player.ts`
- Create: `proxy/test/endpoints/player.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/endpoints/player.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/player.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /player", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/player"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns matches list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["m1", "2026-05-01T00:00:00Z", 5]],
      columns: ["match_id", "played_at", "rounds_seen"],
    }))));

    const res = await handle(new Request("https://x.test/player?id=p1"), env, ctx);
    const json = await res.json() as { data: { matches: { match_id: string }[] } };
    expect(json.data.matches[0]?.match_id).toBe("m1");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- "endpoints/player"`
Expected: FAIL.

- [ ] **Step 3: Implement `proxy/src/endpoints/player.ts`**

```ts
import type { PlayerHistory, PlayerMatchRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

const SQL = `
SELECT properties.match_id AS match_id,
       min(timestamp)      AS played_at,
       max(properties.round) AS rounds_seen
FROM events
WHERE properties.player_id = {player_id}
  AND notEmpty(toString(properties.match_id))
GROUP BY match_id
ORDER BY played_at DESC
LIMIT 500
`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = validateId(url.searchParams.get("id") ?? undefined, "id");
    const rows = await runQuery<PlayerMatchRow>(env, SQL, { player_id: id });
    const body: { data: PlayerHistory; generated_at: string } = {
      data: { matches: rows },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/endpoints/player.ts proxy/test/endpoints/player.test.ts
git commit -m "feat(proxy): add /player endpoint"
```

---

## Task 14: Endpoint — `/powerup-pickrate`

**Files:**
- Create: `proxy/src/endpoints/powerup-pickrate.ts`
- Create: `proxy/test/endpoints/powerup-pickrate.test.ts`

Uses the exact tested SQL from `handoff.md` §"`GET /powerup-pickrate`" (with the `ifNull(toString(...), '[]')` workaround). Accepts `since`/`until` and substitutes them into the inner subquery's date filter.

- [ ] **Step 1: Write failing test `proxy/test/endpoints/powerup-pickrate.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/powerup-pickrate.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /powerup-pickrate", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["shield", 100, 30, 0.3]],
      columns: ["powerup", "times_offered", "times_picked", "pick_rate"],
    }))));

    const res = await handle(new Request("https://x.test/powerup-pickrate"), env, ctx);
    const json = await res.json() as { data: { rows: { powerup: string; pick_rate: number }[] } };
    expect(json.data.rows[0]?.powerup).toBe("shield");
    expect(json.data.rows[0]?.pick_rate).toBeCloseTo(0.3);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- powerup`
Expected: FAIL.

- [ ] **Step 3: Implement `proxy/src/endpoints/powerup-pickrate.ts`**

```ts
import type { PowerupPickrate, PowerupPickrateRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateTimeRange } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

const SQL = `
SELECT
    powerup,
    count()                            AS times_offered,
    countIf(picked = powerup)          AS times_picked,
    countIf(picked = powerup) / count() AS pick_rate
FROM (
    SELECT
        properties.picked AS picked,
        JSONExtractString(
            arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
            'id'
        ) AS powerup
    FROM events
    WHERE event = 'powerup_picked'
      AND timestamp >= {since}
      AND timestamp <  {until}
)
GROUP BY powerup
ORDER BY pick_rate DESC
LIMIT 200
`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { since, until } = validateTimeRange(
      url.searchParams.get("since") ?? undefined,
      url.searchParams.get("until") ?? undefined,
    );
    const rows = await runQuery<PowerupPickrateRow>(env, SQL, { since, until });
    const body: { data: PowerupPickrate; generated_at: string } = {
      data: { rows },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/proxy test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/endpoints/powerup-pickrate.ts proxy/test/endpoints/powerup-pickrate.test.ts
git commit -m "feat(proxy): add /powerup-pickrate endpoint"
```

---

## Task 15: Wire router + CORS + cache in `proxy/src/index.ts`

**Files:**
- Modify: `proxy/src/index.ts`
- Create: `proxy/test/index.test.ts`

- [ ] **Step 1: Write failing test `proxy/test/index.test.ts`**

```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("router", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("OPTIONS preflight responds 204 with allowed origin", async () => {
    const res = await SELF.fetch("https://worker.test/matches", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("returns 404 with JSON for unknown path", async () => {
    const res = await SELF.fetch("https://worker.test/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("adds CORS headers on real responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["arena_a"]], columns: ["map_name"],
    }))));
    const res = await SELF.fetch("https://worker.test/maps");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("returns 500 generic error when handler throws (does not leak upstream)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("posthog raw error body", { status: 500 })));
    const res = await SELF.fetch("https://worker.test/maps");
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("internal");
    expect(JSON.stringify(json)).not.toContain("posthog raw");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/proxy test -- "test/index"`
Expected: FAIL (router doesn't exist yet, current `index.ts` always 404s).

- [ ] **Step 3: Replace `proxy/src/index.ts`**

```ts
import type { Env } from "./env.js";
import * as matches from "./endpoints/matches.js";
import * as match from "./endpoints/match.js";
import * as player from "./endpoints/player.js";
import * as powerupPickrate from "./endpoints/powerup-pickrate.js";
import * as maps from "./endpoints/maps.js";
import * as versions from "./endpoints/versions.js";
import { preflight, withCors } from "./cors.js";
import { cacheJson } from "./cache.js";
import { jsonError } from "./errors.js";

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/matches": matches.handle,
  "/match": match.handle,
  "/player": player.handle,
  "/powerup-pickrate": powerupPickrate.handle,
  "/maps": maps.handle,
  "/versions": versions.handle,
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN;

    if (req.method === "OPTIONS") return preflight(origin);

    const url = new URL(req.url);
    const handler = routes[url.pathname];
    if (!handler) {
      return withCors(jsonError({ error: "not_found" }, 404), origin);
    }

    try {
      const res = await cacheJson(req, ctx, () => handler(req, env, ctx));
      return withCors(res, origin);
    } catch (err) {
      console.error("handler error", err);
      return withCors(jsonError({ error: "internal" }, 500), origin);
    }
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter @pgc/proxy test && pnpm --filter @pgc/proxy typecheck`
Expected: all tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add proxy/src/index.ts proxy/test/index.test.ts
git commit -m "feat(proxy): wire router with CORS, cache, error wrapping"
```

---

## Task 16: Proxy GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy-proxy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy-proxy.yml`**

```yaml
name: Deploy Worker

on:
  push:
    branches: [main]
    paths:
      - 'proxy/**'
      - 'packages/shared/**'
      - 'pnpm-lock.yaml'
      - '.github/workflows/deploy-proxy.yml'

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pgc/proxy typecheck
      - run: pnpm --filter @pgc/proxy test
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: proxy
          secrets: |
            POSTHOG_API_KEY
        env:
          POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-proxy.yml
git commit -m "ci: add Worker deploy workflow"
```

Note for the operator: before the first push to main triggers this, set repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `POSTHOG_API_KEY`.

---

## Task 17: Site scaffold (Vite + React + TS + Tailwind)

**Files:**
- Create: `site/package.json`
- Create: `site/tsconfig.json`
- Create: `site/vite.config.ts`
- Create: `site/vitest.config.ts`
- Create: `site/tailwind.config.ts`
- Create: `site/postcss.config.js`
- Create: `site/index.html`
- Create: `site/public/favicon.svg`
- Create: `site/src/main.tsx`
- Create: `site/src/styles.css`
- Create: `site/src/lib/config.ts`
- Create: `site/test/smoke.test.tsx`

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "@pgc/site",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pgc/shared": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-router": "^1.78.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `site/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "rootDir": ".",
    "paths": {
      "@pgc/shared": ["../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

- [ ] **Step 3: Create `site/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `site/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: Create `site/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create `site/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0b0d10",
        surface: "#15181d",
        border:  "#2a2f37",
        text:    "#e6e8eb",
        muted:   "#8a93a0",
        accent:  "#5eead4",
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 7: Create `site/postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 8: Create `site/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-bg text-text font-sans antialiased; }
```

- [ ] **Step 9: Create `site/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PGC Telemetry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `site/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#5eead4"/><text x="50%" y="58%" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#0b0d10">P</text></svg>
```

- [ ] **Step 11: Create `site/src/lib/config.ts`**

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";
```

- [ ] **Step 12: Create minimal `site/src/main.tsx` (will be replaced in Task 19)**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(<StrictMode><div className="p-8 text-text">Hello, telemetry.</div></StrictMode>);
```

- [ ] **Step 13: Write smoke test `site/test/smoke.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("smoke", () => {
  it("renders a div", () => {
    render(<div>hi</div>);
    expect(screen.getByText("hi")).toBeInTheDocument();
  });
});
```

- [ ] **Step 14: Install, typecheck, test**

Run: `pnpm install && pnpm --filter @pgc/site typecheck && pnpm --filter @pgc/site test`
Expected: install ok; typecheck passes; smoke test passes.

- [ ] **Step 15: Commit**

```bash
git add site pnpm-lock.yaml
git commit -m "feat(site): scaffold React + Vite + Tailwind"
```

---

## Task 18: API client with envelope unwrap

**Files:**
- Create: `site/src/api/client.ts`
- Create: `site/test/api/client.test.ts`

- [ ] **Step 1: Write failing test `site/test/api/client.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiClientError } from "../../src/api/client.js";

describe("api()", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns data from envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { maps: ["a"] }, generated_at: "t" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    const data = await api<{ maps: string[] }>("/maps");
    expect(data).toEqual({ maps: ["a"] });
  });

  it("appends defined query params, skips undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { matches: [] }, generated_at: "t" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await api("/matches", { since: "2026-01-01T00:00:00Z", map: undefined });
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain("since=2026-01-01");
    expect((fetchMock.mock.calls[0]?.[0] as string)).not.toContain("map=");
  });

  it("throws ApiClientError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad", field: "id" }), { status: 400 }),
    ));
    await expect(api("/match", { id: "" })).rejects.toMatchObject({
      status: 400,
      body: { error: "bad", field: "id" },
    });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/site test -- client`
Expected: FAIL.

- [ ] **Step 3: Implement `site/src/api/client.ts`**

```ts
import type { ApiEnvelope, ApiError } from "@pgc/shared";
import { API_BASE_URL } from "../lib/config.js";

export class ApiClientError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.error);
  }
}

export async function api<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: "network" }))) as ApiError;
    throw new ApiClientError(res.status, body);
  }
  const env = (await res.json()) as ApiEnvelope<T>;
  return env.data;
}

export async function apiEnvelope<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<ApiEnvelope<T>> {
  const url = new URL(path, API_BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: "network" }))) as ApiError;
    throw new ApiClientError(res.status, body);
  }
  return (await res.json()) as ApiEnvelope<T>;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm --filter @pgc/site test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add site/src/api/client.ts site/test/api/client.test.ts
git commit -m "feat(site): add API client with envelope unwrap"
```

---

## Task 19: Query hooks + Router setup + root layout

**Files:**
- Create: `site/src/api/queries.ts`
- Create: `site/src/router.tsx`
- Create: `site/src/routes/__root.tsx`
- Create: `site/src/routes/index.tsx`
- Modify: `site/src/main.tsx`

- [ ] **Step 1: Create `site/src/api/queries.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import type {
  MatchesRequest, MatchesResponse,
  MatchDetail,
  PlayerHistory,
  PowerupPickrate,
  MapsResponse, VersionsResponse,
} from "@pgc/shared";
import { apiEnvelope } from "./client.js";

const STALE_MS = 60_000;

export const useMaps = () =>
  useQuery({
    queryKey: ["maps"],
    queryFn: () => apiEnvelope<MapsResponse>("/maps"),
    staleTime: STALE_MS,
  });

export const useVersions = () =>
  useQuery({
    queryKey: ["versions"],
    queryFn: () => apiEnvelope<VersionsResponse>("/versions"),
    staleTime: STALE_MS,
  });

export const useMatches = (filters: MatchesRequest) =>
  useQuery({
    queryKey: ["matches", filters],
    queryFn: () => apiEnvelope<MatchesResponse>("/matches", { ...filters }),
    staleTime: STALE_MS,
  });

export const useMatch = (id: string) =>
  useQuery({
    queryKey: ["match", id],
    queryFn: () => apiEnvelope<MatchDetail>("/match", { id }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });

export const usePlayer = (id: string) =>
  useQuery({
    queryKey: ["player", id],
    queryFn: () => apiEnvelope<PlayerHistory>("/player", { id }),
    staleTime: STALE_MS,
    enabled: id.length > 0,
  });

export const usePowerupPickrate = (range: { since?: string; until?: string }) =>
  useQuery({
    queryKey: ["powerup-pickrate", range],
    queryFn: () => apiEnvelope<PowerupPickrate>("/powerup-pickrate", { ...range }),
    staleTime: STALE_MS,
  });
```

- [ ] **Step 2: Create `site/src/routes/__root.tsx`**

```tsx
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

function Nav() {
  return (
    <header className="border-b border-border bg-surface px-6 py-3 flex items-center gap-6">
      <span className="font-bold text-accent">PGC Telemetry</span>
      <nav className="flex gap-4 text-sm">
        <Link to="/matches" className="text-muted [&.active]:text-text">Matches</Link>
        <Link to="/balance/powerups" className="text-muted [&.active]:text-text">Balance · Powerups</Link>
      </nav>
    </header>
  );
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-full flex flex-col">
      <Nav />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  ),
});
```

- [ ] **Step 3: Create `site/src/routes/index.tsx`**

```tsx
import { createRoute, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => { throw redirect({ to: "/matches" }); },
});
```

- [ ] **Step 4: Create `site/src/router.tsx`** (placeholder routes for not-yet-built pages, replaced in tasks 21-24)

```tsx
import { createRouter, createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";

const placeholder = (path: string, name: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <div className="text-muted">{name} — coming up</div>,
  });

const routeTree = rootRoute.addChildren([
  indexRoute,
  placeholder("/matches", "Matches"),
  placeholder("/matches/$id", "Match detail"),
  placeholder("/players/$id", "Player history"),
  placeholder("/balance/powerups", "Powerup pick-rate"),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 5: Replace `site/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router.js";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Verify typecheck + build smoke**

Run: `pnpm --filter @pgc/site typecheck && pnpm --filter @pgc/site build`
Expected: typecheck clean; build produces `site/dist/` with no errors.

- [ ] **Step 7: Commit**

```bash
git add site/src
git commit -m "feat(site): wire router, query client, root layout"
```

---

## Task 20: Common UI components

**Files:**
- Create: `site/src/components/LoadingState.tsx`
- Create: `site/src/components/ErrorState.tsx`
- Create: `site/src/components/EmptyState.tsx`
- Create: `site/src/components/UpdatedAt.tsx`
- Create: `site/src/components/DataTable.tsx`
- Create: `site/src/lib/format.ts`
- Create: `site/test/components/DataTable.test.tsx`

- [ ] **Step 1: Create `site/src/lib/format.ts`**

```ts
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
```

- [ ] **Step 2: Create `site/src/components/LoadingState.tsx`**

```tsx
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="text-muted py-8">{label}</div>;
}
```

- [ ] **Step 3: Create `site/src/components/ErrorState.tsx`**

```tsx
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-border bg-surface rounded p-6 my-4">
      <div className="text-text font-medium mb-1">Something went wrong</div>
      <div className="text-muted text-sm mb-3">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-accent text-sm hover:underline">Retry</button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `site/src/components/EmptyState.tsx`**

```tsx
export function EmptyState({ message }: { message: string }) {
  return <div className="text-muted py-8">{message}</div>;
}
```

- [ ] **Step 5: Create `site/src/components/UpdatedAt.tsx`**

```tsx
import { formatRelative } from "../lib/format.js";

export function UpdatedAt({ iso }: { iso: string }) {
  return <div className="text-muted text-xs mt-4">Updated {formatRelative(iso)}</div>;
}
```

- [ ] **Step 6: Write failing test `site/test/components/DataTable.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "../../src/components/DataTable.js";

type Row = { name: string; n: number };
const cols: Column<Row>[] = [
  { key: "name",  label: "Name", sortable: true },
  { key: "n",     label: "N",    sortable: true, align: "right" },
];
const rows: Row[] = [
  { name: "alpha", n: 3 },
  { name: "beta",  n: 1 },
  { name: "gamma", n: 2 },
];

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("sorts by clicked column ascending then descending", () => {
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} />);
    fireEvent.click(screen.getByText("N"));
    let cells = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-col") === "n");
    expect(cells.map((c) => c.textContent)).toEqual(["1", "2", "3"]);
    fireEvent.click(screen.getByText("N"));
    cells = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-col") === "n");
    expect(cells.map((c) => c.textContent)).toEqual(["3", "2", "1"]);
  });

  it("fires onRowClick", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("alpha"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: "alpha" }));
  });
});
```

- [ ] **Step 7: Run test, verify fail**

Run: `pnpm --filter @pgc/site test -- DataTable`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement `site/src/components/DataTable.tsx`**

```tsx
import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  /** Used for sort comparison; defaults to row[key] cast to string|number */
  sortValue?: (row: T) => string | number;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No data.",
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const sortValue = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number);
    return [...rows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const handleSort = (key: string) => {
    setSort((s) => {
      if (s?.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  if (rows.length === 0) return <div className="text-muted py-8">{emptyMessage}</div>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border">
          {columns.map((c) => (
            <th
              key={c.key}
              className={`px-3 py-2 font-medium text-muted ${c.align === "right" ? "text-right" : "text-left"} ${
                c.sortable ? "cursor-pointer select-none" : ""
              }`}
              onClick={c.sortable ? () => handleSort(c.key) : undefined}
            >
              {c.label}
              {sort?.key === c.key && (sort.dir === "asc" ? " ▲" : " ▼")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr
            key={getRowKey(row)}
            className={`border-b border-border ${onRowClick ? "cursor-pointer hover:bg-surface" : ""}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((c) => {
              const value = c.render
                ? c.render(row)
                : (row as Record<string, unknown>)[c.key] as ReactNode;
              return (
                <td
                  key={c.key}
                  data-col={c.key}
                  className={`px-3 py-2 ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  {value as ReactNode}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 9: Run tests + typecheck**

Run: `pnpm --filter @pgc/site test && pnpm --filter @pgc/site typecheck`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add site/src/components site/src/lib/format.ts site/test/components
git commit -m "feat(site): add common UI components (DataTable, states, format)"
```

---

## Task 21: Filter bar + time range picker

**Files:**
- Create: `site/src/components/TimeRangePicker.tsx`
- Create: `site/src/components/FilterBar.tsx`

The filter bar is a thin layout: time range picker + map dropdown + version dropdown. It accepts current values and an onChange callback. Routes own filter state (search params), the bar is dumb.

- [ ] **Step 1: Create `site/src/components/TimeRangePicker.tsx`**

```tsx
type Preset = "7d" | "30d" | "90d" | "custom";

function presetToRange(preset: Exclude<Preset, "custom">): { since: string; until: string } {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const now = Date.now();
  return {
    since: new Date(now - days * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export function TimeRangePicker({
  preset,
  onChange,
}: {
  preset: Preset;
  onChange: (preset: Exclude<Preset, "custom">, range: { since: string; until: string }) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["7d", "30d", "90d"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p, presetToRange(p))}
          className={`px-3 py-1 text-sm rounded border ${
            preset === p ? "border-accent text-accent" : "border-border text-muted hover:text-text"
          }`}
        >
          Last {p}
        </button>
      ))}
    </div>
  );
}
```

(Custom date picker deferred — v1 ships presets only.)

- [ ] **Step 2: Create `site/src/components/FilterBar.tsx`**

```tsx
import { TimeRangePicker } from "./TimeRangePicker.js";

type Preset = "7d" | "30d" | "90d";

export function FilterBar({
  preset,
  onPresetChange,
  map,
  maps,
  onMapChange,
  version,
  versions,
  onVersionChange,
}: {
  preset: Preset;
  onPresetChange: (preset: Preset, range: { since: string; until: string }) => void;
  map?: string;
  maps: string[];
  onMapChange: (map: string | undefined) => void;
  version?: string;
  versions: string[];
  onVersionChange: (version: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <TimeRangePicker preset={preset} onChange={onPresetChange} />
      <select
        value={map ?? ""}
        onChange={(e) => onMapChange(e.target.value || undefined)}
        className="bg-surface border border-border text-text rounded px-2 py-1 text-sm"
      >
        <option value="">All maps</option>
        {maps.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        value={version ?? ""}
        onChange={(e) => onVersionChange(e.target.value || undefined)}
        className="bg-surface border border-border text-text rounded px-2 py-1 text-sm"
      >
        <option value="">All versions</option>
        {versions.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @pgc/site typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/TimeRangePicker.tsx site/src/components/FilterBar.tsx
git commit -m "feat(site): add filter bar and time range picker"
```

---

## Task 22: `/matches` route with filters + URL search params

**Files:**
- Create: `site/src/routes/matches.tsx`
- Modify: `site/src/router.tsx`
- Create: `site/test/routes/matches.test.tsx`

- [ ] **Step 1: Write failing test `site/test/routes/matches.test.tsx`**

```tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Route as rootRoute } from "../../src/routes/__root.js";
import { Route as matchesRoute } from "../../src/routes/matches.js";

const server = setupServer(
  http.get("http://127.0.0.1:8787/maps",     () => HttpResponse.json({ data: { maps: ["arena_a", "arena_b"] }, generated_at: "t" })),
  http.get("http://127.0.0.1:8787/versions", () => HttpResponse.json({ data: { versions: ["1.0.0"] }, generated_at: "t" })),
  http.get("http://127.0.0.1:8787/matches",  () => HttpResponse.json({
    data: { matches: [{ match_id: "m1", started_at: "2026-05-01T00:00:00Z", map: "arena_a",
                        rounds: 5, players: 4, max_players: 8, round_duration_s: 60, version: "1.0.0" }] },
    generated_at: "t",
  })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderRoute(initialPath: string) {
  const routeTree = rootRoute.addChildren([matchesRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("/matches", () => {
  it("renders matches table after load", async () => {
    renderRoute("/matches");
    await waitFor(() => expect(screen.getByText("m1")).toBeInTheDocument());
  });

  it("changing map filter triggers refetch with map param", async () => {
    renderRoute("/matches");
    await waitFor(() => expect(screen.getByText("All maps")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("All maps"), { target: { value: "arena_b" } });
    await waitFor(() => expect(screen.getByDisplayValue("arena_b")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `pnpm --filter @pgc/site test -- "routes/matches"`
Expected: FAIL (route not found).

- [ ] **Step 3: Create `site/src/routes/matches.tsx`**

```tsx
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useMatches, useMaps, useVersions } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { FilterBar } from "../components/FilterBar.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDateTime, formatDuration } from "../lib/format.js";
import type { Match } from "@pgc/shared";

type Search = {
  preset: "7d" | "30d" | "90d";
  since?: string;
  until?: string;
  map?: string;
  version?: string;
};

function MatchesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/matches" });
  const mapsQ = useMaps();
  const versionsQ = useVersions();
  const matchesQ = useMatches({ since: search.since, until: search.until, map: search.map, version: search.version });

  const setSearch = (next: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }) });

  const columns: Column<Match>[] = [
    { key: "started_at", label: "Started", sortable: true, render: (r) => formatDateTime(r.started_at) },
    { key: "map",        label: "Map",     sortable: true },
    { key: "version",    label: "Version", sortable: true },
    { key: "rounds",     label: "Rounds",  sortable: true, align: "right" },
    { key: "players",    label: "Players", sortable: true, align: "right",
      render: (r) => `${r.players}/${r.max_players}` },
    { key: "round_duration_s", label: "Round len", sortable: true, align: "right",
      render: (r) => formatDuration(r.round_duration_s) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Matches</h1>
      <FilterBar
        preset={search.preset}
        onPresetChange={(preset, range) => setSearch({ preset, since: range.since, until: range.until })}
        map={search.map}
        maps={mapsQ.data?.data.maps ?? []}
        onMapChange={(map) => setSearch({ map })}
        version={search.version}
        versions={versionsQ.data?.data.versions ?? []}
        onVersionChange={(version) => setSearch({ version })}
      />

      {matchesQ.isPending && <LoadingState />}
      {matchesQ.isError && (
        <ErrorState message={(matchesQ.error as Error).message} onRetry={() => matchesQ.refetch()} />
      )}
      {matchesQ.data && (
        <>
          <DataTable<Match>
            columns={columns}
            rows={matchesQ.data.data.matches}
            getRowKey={(r) => r.match_id}
            onRowClick={(r) => navigate({ to: "/matches/$id", params: { id: r.match_id } })}
            emptyMessage="No matches in selected range."
          />
          <UpdatedAt iso={matchesQ.data.generated_at} />
        </>
      )}
    </div>
  );
}

const DEFAULT_DAYS = 30;
function defaultRange() {
  const now = Date.now();
  return {
    since: new Date(now - DEFAULT_DAYS * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches",
  component: MatchesPage,
  validateSearch: (raw: Record<string, unknown>): Search => {
    const def = defaultRange();
    return {
      preset: (raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d"),
      since: typeof raw.since === "string" ? raw.since : def.since,
      until: typeof raw.until === "string" ? raw.until : def.until,
      map: typeof raw.map === "string" && raw.map.length > 0 ? raw.map : undefined,
      version: typeof raw.version === "string" && raw.version.length > 0 ? raw.version : undefined,
    };
  },
});
```

- [ ] **Step 4: Replace `/matches` placeholder in `site/src/router.tsx`**

Replace the existing `router.tsx` content with:

```tsx
import { createRouter, createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";

const placeholder = (path: string, name: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <div className="text-muted">{name} — coming up</div>,
  });

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  placeholder("/matches/$id", "Match detail"),
  placeholder("/players/$id", "Player history"),
  placeholder("/balance/powerups", "Powerup pick-rate"),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 5: Run tests + typecheck + build**

Run: `pnpm --filter @pgc/site test && pnpm --filter @pgc/site typecheck && pnpm --filter @pgc/site build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add site/src/routes/matches.tsx site/src/router.tsx site/test/routes/matches.test.tsx
git commit -m "feat(site): add /matches route with URL filters"
```

---

## Task 23: `/matches/$id` route (match detail)

**Files:**
- Create: `site/src/routes/matches.$id.tsx`
- Modify: `site/src/router.tsx`

- [ ] **Step 1: Create `site/src/routes/matches.$id.tsx`**

```tsx
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useMatch } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { EmptyState } from "../components/EmptyState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDuration } from "../lib/format.js";
import type { ScoreboardRow } from "@pgc/shared";

function MatchDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate({ from: "/matches/$id" });
  const q = useMatch(id);

  const columns: Column<ScoreboardRow>[] = [
    { key: "player_id", label: "Player",
      render: (r) => <span className="text-accent">{r.player_id}</span> },
    { key: "kills",     label: "Kills",  sortable: true, align: "right" },
    { key: "deaths",    label: "Deaths", sortable: true, align: "right" },
    { key: "points",    label: "Points", sortable: true, align: "right" },
  ];

  return (
    <div>
      <button onClick={() => navigate({ to: "/matches" })} className="text-muted text-sm mb-3 hover:text-text">← Matches</button>
      <h1 className="text-xl font-semibold mb-2">Match {id}</h1>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          {q.data.data.overview ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-sm">
              <Field k="Map">{q.data.data.overview.map}</Field>
              <Field k="Version">{q.data.data.overview.version}</Field>
              <Field k="Players">{q.data.data.overview.players}/{q.data.data.overview.max_players}</Field>
              <Field k="Rounds">{q.data.data.overview.rounds}</Field>
              <Field k="Round length">{formatDuration(q.data.data.overview.round_s)}</Field>
            </dl>
          ) : (
            <EmptyState message="No overview for this match." />
          )}

          <h2 className="text-lg font-medium mb-2">Scoreboard</h2>
          <DataTable<ScoreboardRow>
            columns={columns}
            rows={q.data.data.scoreboard}
            getRowKey={(r) => r.player_id}
            onRowClick={(r) => navigate({ to: "/players/$id", params: { id: r.player_id } })}
            emptyMessage="No player rounds recorded."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface rounded p-3">
      <div className="text-muted text-xs uppercase tracking-wide">{k}</div>
      <div className="text-text">{children}</div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$id",
  component: MatchDetailPage,
});
```

- [ ] **Step 2: Replace `/matches/$id` placeholder in `site/src/router.tsx`**

```tsx
import { createRouter, createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";

const placeholder = (path: string, name: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <div className="text-muted">{name} — coming up</div>,
  });

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  placeholder("/players/$id", "Player history"),
  placeholder("/balance/powerups", "Powerup pick-rate"),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm --filter @pgc/site typecheck && pnpm --filter @pgc/site build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/matches.\$id.tsx site/src/router.tsx
git commit -m "feat(site): add /matches/:id detail route"
```

---

## Task 24: `/players/$id` route (player history)

**Files:**
- Create: `site/src/routes/players.$id.tsx`
- Modify: `site/src/router.tsx`

- [ ] **Step 1: Create `site/src/routes/players.$id.tsx`**

```tsx
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePlayer } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDateTime } from "../lib/format.js";
import type { PlayerMatchRow } from "@pgc/shared";

function PlayerHistoryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate({ from: "/players/$id" });
  const q = usePlayer(id);

  const columns: Column<PlayerMatchRow>[] = [
    { key: "played_at",   label: "Played",      sortable: true, render: (r) => formatDateTime(r.played_at) },
    { key: "match_id",    label: "Match",       render: (r) => <span className="text-accent">{r.match_id}</span> },
    { key: "rounds_seen", label: "Rounds seen", sortable: true, align: "right" },
  ];

  return (
    <div>
      <button onClick={() => navigate({ to: "/matches" })} className="text-muted text-sm mb-3 hover:text-text">← Matches</button>
      <h1 className="text-xl font-semibold mb-4">Player {id}</h1>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <DataTable<PlayerMatchRow>
            columns={columns}
            rows={q.data.data.matches}
            getRowKey={(r) => r.match_id}
            onRowClick={(r) => navigate({ to: "/matches/$id", params: { id: r.match_id } })}
            emptyMessage="This player has no recorded matches."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$id",
  component: PlayerHistoryPage,
});
```

- [ ] **Step 2: Replace `/players/$id` placeholder in `site/src/router.tsx`**

```tsx
import { createRouter, createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";
import { Route as playerRoute } from "./routes/players.$id.js";

const placeholder = (path: string, name: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <div className="text-muted">{name} — coming up</div>,
  });

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  playerRoute,
  placeholder("/balance/powerups", "Powerup pick-rate"),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm --filter @pgc/site typecheck && pnpm --filter @pgc/site build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/players.\$id.tsx site/src/router.tsx
git commit -m "feat(site): add /players/:id history route"
```

---

## Task 25: `/balance/powerups` route

**Files:**
- Create: `site/src/routes/balance.powerups.tsx`
- Modify: `site/src/router.tsx`

- [ ] **Step 1: Create `site/src/routes/balance.powerups.tsx`**

```tsx
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePowerupPickrate } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatPercent } from "../lib/format.js";
import type { PowerupPickrateRow } from "@pgc/shared";

type Preset = "7d" | "30d" | "90d";
type Search = { preset: Preset; since?: string; until?: string };

function PowerupPickratePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/balance/powerups" });
  const q = usePowerupPickrate({ since: search.since, until: search.until });

  const columns: Column<PowerupPickrateRow>[] = [
    { key: "powerup",       label: "Powerup",     sortable: true },
    { key: "times_offered", label: "Offered",     sortable: true, align: "right" },
    { key: "times_picked",  label: "Picked",      sortable: true, align: "right" },
    { key: "pick_rate",     label: "Pick rate",   sortable: true, align: "right",
      render: (r) => formatPercent(r.pick_rate) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Powerup pick-rate</h1>
      <div className="mb-4">
        <TimeRangePicker
          preset={search.preset}
          onChange={(preset, range) =>
            navigate({ search: (prev) => ({ ...prev, preset, since: range.since, until: range.until }) })
          }
        />
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <DataTable<PowerupPickrateRow>
            columns={columns}
            rows={q.data.data.rows}
            getRowKey={(r) => r.powerup}
            emptyMessage="No powerup data in selected range."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

const DEFAULT_DAYS = 30;
function defaultRange() {
  const now = Date.now();
  return {
    since: new Date(now - DEFAULT_DAYS * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/balance/powerups",
  component: PowerupPickratePage,
  validateSearch: (raw: Record<string, unknown>): Search => {
    const def = defaultRange();
    return {
      preset: (raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d"),
      since: typeof raw.since === "string" ? raw.since : def.since,
      until: typeof raw.until === "string" ? raw.until : def.until,
    };
  },
});
```

- [ ] **Step 2: Replace `/balance/powerups` placeholder in `site/src/router.tsx`** (no more placeholders)

```tsx
import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";
import { Route as playerRoute } from "./routes/players.$id.js";
import { Route as powerupsRoute } from "./routes/balance.powerups.js";

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  playerRoute,
  powerupsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 3: Verify typecheck + build + run all tests**

Run: `pnpm -r test && pnpm -r typecheck && pnpm --filter @pgc/site build`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/balance.powerups.tsx site/src/router.tsx
git commit -m "feat(site): add /balance/powerups route"
```

---

## Task 26: Site GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy-site.yml`

- [ ] **Step 1: Create `.github/workflows/deploy-site.yml`**

```yaml
name: Deploy Site

on:
  push:
    branches: [main]
    paths:
      - 'site/**'
      - 'packages/shared/**'
      - 'pnpm-lock.yaml'
      - '.github/workflows/deploy-site.yml'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pgc/site typecheck
      - run: pnpm --filter @pgc/site test
      - run: pnpm --filter @pgc/site build
        env:
          VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-site.yml
git commit -m "ci: add Pages deploy workflow"
```

Note for the operator: in repo settings, set Pages source = "GitHub Actions" and set repo variable `VITE_API_BASE_URL` to the deployed Worker URL after Task 16's first successful deploy. After that, re-run the site workflow once so the build picks up the variable.

---

## Task 27: Production CORS configuration

**Files:**
- Modify: `proxy/wrangler.toml`

After Pages is live and the URL is known, update the Worker's `ALLOWED_ORIGIN`.

- [ ] **Step 1: Modify `proxy/wrangler.toml`**

Update the `[vars]` section. Replace the placeholder with the actual Pages origin:

```toml
[vars]
ALLOWED_ORIGIN = "https://<user>.github.io"
```

If Pages is served at a project subpath (e.g. `https://<user>.github.io/telemetry-dashboard/`), `ALLOWED_ORIGIN` still must be the **origin only**: `https://<user>.github.io`. Origins do not include paths.

- [ ] **Step 2: Commit + push**

```bash
git add proxy/wrangler.toml
git commit -m "chore(proxy): set production CORS allowed origin"
```

Pushing to main triggers `deploy-proxy.yml` and applies the new origin.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task(s) |
|---|---|
| 2.1 Repo layout (monorepo) | 1 |
| 3.1 Worker layout | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 |
| 3.2 Request lifecycle | 15 (router) — uses helpers from 5, 6, 7 |
| 3.3 Endpoint contract (types) | 2 |
| 3.4 SQL | 11, 12, 13, 14 |
| 3.5 Validation | 9, used by 11/12/13/14 |
| 3.6 Cache | 7, 15 |
| 3.7 CORS | 5, 15, 27 |
| 3.8 Configuration | 3 (initial), 27 (prod origin) |
| 4 Frontend (stack, layout, routes, data, UI, config) | 17–25 |
| 5 Shared types package | 2 |
| 6 Error matrix | 6, 9, 15 (server side); 18, 20 (client states); 22–25 (route wiring) |
| 7 Security checklist | 4 (no SQL passthrough — runQuery uses values), 9 (allowlist), 11 (validators applied), 15 (generic 500, never leaks) |
| 8 Testing | every backend task ships a Vitest test; frontend gets DataTable test (20) + /matches route test (22) |
| 9 Deployment | 16, 26 |
| 10 v1 scope | covered end-to-end |
| 11 Upgrade paths | noted in spec; not built |

No gaps.

**2. Placeholder scan:** No "TBD", "TODO", "fill in", or hand-wavy "add error handling" steps. Every code step ships complete code. Operator notes (Pages "Source = GitHub Actions" toggle, repo variable to set, prod origin update) appear in tasks 26 and 27 with concrete steps.

**3. Type / signature consistency:**
- `runQuery<T>(env, sql, values)` — used identically in tasks 4, 8, 11, 12, 13, 14. ✓
- `ApiHttpError(status, body)` — used identically in tasks 6, 9, 11, 12, 13, 14. ✓
- `jsonResponse(body, status, cacheSeconds)` — used identically across endpoints. ✓
- `cacheJson(req, ctx, handler)` — defined in 7, used in 15. ✓
- `withCors(res, origin)` / `preflight(origin)` — defined in 5, used in 15. ✓
- `getMaps(env)` / `getVersions(env)` — defined in 8, used in 10, 11. ✓
- `api<T>` / `apiEnvelope<T>` — defined in 18, used by queries in 19; query hooks return envelope shape consistently used by routes in 22–25. ✓
- Shared types (`Match`, `MatchDetail`, `PlayerHistory`, `PowerupPickrate`, `MapsResponse`, `VersionsResponse`, `ScoreboardRow`, `PlayerMatchRow`, `PowerupPickrateRow`) defined once in 2 and reused throughout. ✓
- `DataTable<T>` `Column<T>` API: `{ key, label, render?, sortable?, align?, sortValue? }` — declared in 20, used in 22, 23, 24, 25. ✓

No mismatches.
