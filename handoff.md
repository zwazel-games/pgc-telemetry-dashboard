# Feature: Live PostHog Analytics Site (Cloudflare Worker proxy + GitHub Pages)

## Goal
A public website that displays live game-telemetry analytics from PostHog,
rendered however we want (custom UI), including a "list all matches → click a
match → match detail view" flow. Free to host. The PostHog read key must never
reach the browser.

## Architecture
```
GitHub Pages (static frontend, custom UI)
        │  fetch() over HTTPS, CORS-locked
        ▼
Cloudflare Worker  (the "read API" — holds the secret key, curated query menu)
        │  POST /api/projects/189316/query/  (HogQL, Bearer phx_ key)
        ▼
PostHog Cloud (EU)
```
- **Worker = backend-for-frontend.** Holds the PostHog key as an encrypted
  secret, exposes a *fixed menu* of endpoints, each with server-side SQL.
- **Pages = custom UI** over that menu. Vanilla JS + a chart lib (e.g. Chart.js)
  is enough.
- Live data, with a short edge cache (see Security) so we don't hammer PostHog.

## NON-NEGOTIABLE security rule
The Worker must **NOT** be an open query passthrough. The frontend never sends
SQL. Each endpoint has its SQL hardcoded in the Worker; the client only passes
**validated parameters**. If the Worker forwarded arbitrary HogQL, anyone who
reads the Worker URL in browser devtools could read ALL telemetry — defeating
the whole point. The data is **pseudonymous, not anonymous** (persistent
per-install ids), so leaking read access is a real privacy problem.

## PostHog facts (verified)
- **Query API host (EU):** `https://eu.posthog.com`
  (note: ingest host `https://eu.i.posthog.com` is for capture only — do NOT use
  it for queries)
- **Project ID:** `189316`
- **Query endpoint:** `POST https://eu.posthog.com/api/projects/189316/query/`
- **Auth:** header `Authorization: Bearer <phx_ personal API key>`
- **Request body shape:**
  ```json
  { "query": { "kind": "HogQLQuery", "query": "SELECT ...", "values": { } } }
  ```
- **Response:** JSON with `results` (array of rows) and `columns`.
- **Parameterized queries (use for any user-supplied value — injection-safe):**
  put a placeholder `{name}` in the SQL and pass it in `values`:
  ```json
  { "query": {
      "kind": "HogQLQuery",
      "query": "SELECT * FROM events WHERE properties.match_id = {match_id}",
      "values": { "match_id": "abc123" }
  } }
  ```
  (Confirm exact placeholder behavior against PostHog HogQL docs while building.)
- Queries are **ad-hoc**: nothing is pre-stored on PostHog. The SQL lives in the
  Worker and is sent on each request. (PostHog "saved insights" and "query
  endpoints" exist but we are NOT using them.)

## Keys (IMPORTANT)
- **`phc_…` project key** (`phc_CBTYEqVRxG6r9jBA46XZ8wnt6z4hvVZirTj6XAJZq4VR`,
  hardcoded in the game at `src/telemetry/client.rs:29`) is **write-only** and
  CANNOT read data. Do not use it here.
- **`phx_…` personal key** is the only thing that can read. It must stay
  server-side (Worker secret), never in the frontend.
  - **ACTION:** the previously-used broad personal key was exposed in chat —
    rotate/revoke it. Create a **new personal API key scoped to: read-only,
    project 189316 only, `query` resource only.** Store it as the Worker secret
    `POSTHOG_API_KEY`.

## Event schema (source of truth: `docs/telemetry.md` in the game repo)
Events: `match_started`, `match_ended`, `player_round_summary`, `kill`,
`death`, `powerup_picked`, `class_picked`, `weapon_picked`, `survey_response`,
`crash`. The three `*_picked` events share an identical shape (`offered` array
of `{id, rarity}`, `picked` id, `player_id`) and are served by one shared
proxy module — `/powerup`, `/class`, `/weapon` (detail) and
`/<entity>-pickrate` (list). See `proxy/src/endpoints/pick-analytics.ts`.
Gotchas the queries must respect:
- `player_round_summary.kills/deaths/points_awarded` are **per-round deltas** →
  always `sum()` for per-match/per-player totals, never read a single row.
- `match_started`/`match_ended`/`crash` are **person-less** (`distinct_id` is the
  `match_id`/crash hash, not a player).
- The `*_picked` events' `offered` property is an **array of `{id, rarity}`**
  → need `arrayJoin(JSONExtractArrayRaw(...))` to unnest.
- **No win/loss event** → derive placement by ranking players on
  `sum(points_awarded)` within a `match_id`.
- The player↔match many-to-many is already in the data: every per-player event
  carries both `player_id` and `match_id`. (PostHog "Groups" would be the native
  way to model this but it's a PAID add-on, not on our free plan — so we do it
  query-side.)

## Endpoint menu (v1) — SQL is final/tested unless noted
All `properties.*` accesses assume the JSON property names from the schema above.

### `GET /matches` → match list
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
ORDER BY started_at DESC
```

### `GET /match?id=<match_id>` → match detail (run BOTH, return combined JSON)
Validate `id` (non-empty string; reject anything weird) and pass via `values`.

Overview:
```sql
SELECT properties.map_name AS map, properties.total_rounds AS rounds,
       properties.player_count AS players, properties.max_players AS max_players,
       properties.round_duration_secs AS round_s, properties.game_version AS version
FROM events
WHERE event = 'match_started' AND properties.match_id = {match_id}
```
Scoreboard (players in that match):
```sql
SELECT properties.player_id           AS player_id,
       sum(properties.kills)          AS kills,
       sum(properties.deaths)         AS deaths,
       sum(properties.points_awarded) AS points
FROM events
WHERE event = 'player_round_summary' AND properties.match_id = {match_id}
GROUP BY player_id
ORDER BY points DESC
```

### `GET /powerup-pickrate` → powerup pick-rate when offered (TESTED, working)
```sql
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
      AND timestamp > now() - INTERVAL 30 DAY
)
GROUP BY powerup
ORDER BY pick_rate DESC
```
Notes from building this query (don't regress): `properties.offered` is Nullable,
so `JSONExtractArrayRaw` needs `ifNull(toString(...), '[]')` or it errors with
"Nested type Array(String) cannot be inside Nullable type". `pick_rate` is a
0–1 fraction (frontend formats as %).

### (optional) `GET /player?id=<player_id>` → matches a player was in
```sql
SELECT properties.match_id AS match_id, min(timestamp) AS played_at,
       max(properties.round) AS rounds_seen
FROM events
WHERE properties.player_id = {player_id} AND notEmpty(toString(properties.match_id))
GROUP BY match_id ORDER BY played_at DESC
```

## Worker responsibilities (cross-cutting)
- **CORS:** `Access-Control-Allow-Origin` = the exact Pages origin
  (e.g. `https://<user>.github.io`), not `*`. Handle preflight `OPTIONS`.
- **Edge cache:** cache each endpoint response ~15s (Cloudflare Cache API or KV).
  "Live enough" for humans; protects PostHog rate limits + cost.
- **Rate limit:** basic per-IP limit (Cloudflare rule or in-Worker counter).
- **Param validation:** reject malformed `id`s before querying; always use
  `values` placeholders, never string-concatenate into SQL.
- **Error handling:** never leak the PostHog key or raw upstream errors to the
  client; return a clean JSON error + status.

## Deployment: Cloudflare Worker via GitHub Actions (auto-deploy on push)
Yes — Worker is created and updated entirely from CI. No manual dashboard steps
after initial token creation.

`proxy/wrangler.toml`:
```toml
name = "pgc-telemetry-proxy"
main = "src/index.js"
compatibility_date = "2025-01-01"
```

`.github/workflows/deploy-proxy.yml`:
```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths: ['proxy/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
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
The `secrets:` block uploads `POSTHOG_API_KEY` to the Worker as an encrypted
secret on every deploy — it's read in the Worker as `env.POSTHOG_API_KEY`.

### Required GitHub repo secrets
- `CLOUDFLARE_API_TOKEN` — Cloudflare token with the "Edit Cloudflare Workers"
  permission template.
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard.
- `POSTHOG_API_KEY` — the NEW scoped read-only `phx_` key (see Keys section).

## Frontend (GitHub Pages)
- Static site (plain HTML/JS or a tiny framework) in e.g. `/site`, deployed to
  Pages (via Actions or a branch).
- Calls the Worker endpoints, renders:
  - **Matches page:** table from `/matches`, each row links to…
  - **Match detail:** reads `?id=`, calls `/match?id=`, shows overview +
    scoreboard. (This is the real "list → click → detail" we wanted; trivial
    once we own the HTML.)
  - **Balance page:** `/powerup-pickrate` as a sortable table / bar chart.
- Set the Worker URL as a JS constant (it's public; that's fine).

## Open decisions to confirm with the user before building
1. **Cloudflare account** — does one exist? Need `CLOUDFLARE_ACCOUNT_ID` + an API
   token. (Free tier: 100k Worker req/day — plenty.)
2. **Repo layout** — new dedicated repo, or a folder in an existing one? (Worker
   + frontend can co-locate.) Pages needs the repo to allow Pages.
3. **Pages origin/domain** — `https://<user>.github.io/<repo>` or a custom domain?
   Needed to lock CORS.
4. **Cache TTL** — default 15s OK, or do you want tighter/looser?
5. **v1 endpoint set** — matches + match detail + powerup pick-rate enough to
   start? (player endpoint optional.)
6. **Rotate the exposed key** and create the scoped read-only one.

## Out of scope (for now)
Auth/login on the site, write operations, PostHog Groups (paid), deeper
per-match drill-downs beyond overview+scoreboard, historical pre-aggregation.