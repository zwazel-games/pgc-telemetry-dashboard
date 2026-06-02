# Pick-analytics sharing + class/weapon views — design

**Date:** 2026-06-02
**Status:** approved (brainstorm)

## Goal

Add dashboard pick-rate + detail analytics for **classes** and **weapons**,
mirroring the existing powerup views. In doing so, replace the per-file
duplication of the powerup endpoints/routes with a single parameterized
**pick-analytics** abstraction shared by all three entities.

Driven by a game-side telemetry change (separate repo): the pregame pick
events were renamed to mirror `powerup_picked` —

| entity  | event           |
| ------- | --------------- |
| powerup | `powerup_picked`|
| class   | `class_picked`  |
| weapon  | `weapon_picked` |

All three events share the **identical** property shape:
`offered` (JSON array of `{id, rarity}`), `picked` (id string),
`player_id`, `match_id`. Powerup additionally carries round/turn/luck
fields, but the pick-analytics queries never read those — so the three are
interchangeable for these views.

## Why factor (revising the "duplication intentional" rule)

`CLAUDE.md` currently says *"Don't refactor this into a shared wrapper — the
duplication is intentional, and endpoints diverge as filters/joins grow."*
That holds for `/matches`, `/match`, `/player` — they genuinely diverge. It
does **not** hold for the `*_picked` family: pickrate + detail are
structurally identical across powerup/class/weapon, differing only by event
name and a display label. Hand-copying four large HogQL strings per entity
(and keeping them in sync) is the bad kind of duplication.

**Rule revision:** divergent endpoints stay one-file-per-route; a
structurally-identical endpoint *family* is factored into a shared
parameterized builder under `endpoints/`. Adding a new pick entity is then
one config entry, not a file copy.

## Proxy (`proxy/src/`)

### New module: `endpoints/pick-analytics.ts`

- The four HogQL templates (pickrate, stats, co-offers, players) as
  module-level builders that interpolate **only** the hardcoded `event`
  name. The event is a fixed constant per entity — never user-supplied — so
  the "Worker is not a SQL passthrough" rule is preserved (user values still
  flow only through `{since}`/`{until}`/`{id}` placeholders via `runQuery`).
- Neutral output columns: `id`, `other_id`, `player_id` (was `powerup` /
  `other_powerup`).
- Two handler factories returning the existing endpoint shape
  (validate → `runQuery` → `ApiEnvelope` → `jsonResponse`, `ApiHttpError`
  passthrough):
  - `makePickrateHandler(event): Handler`
  - `makeDetailHandler(event): Handler`
- A `PICK_ENTITIES` config and a derived `pickAnalyticsRoutes: Record<string, Handler>`:

  ```ts
  const PICK_ENTITIES = [
    { path: "powerup", event: "powerup_picked" },
    { path: "class",   event: "class_picked"   },
    { path: "weapon",  event: "weapon_picked"  },
  ];
  // → "/powerup", "/powerup-pickrate", "/class", "/class-pickrate",
  //   "/weapon", "/weapon-pickrate"
  ```

### `endpoints/index` wiring

`index.ts` spreads `...pickAnalyticsRoutes` into its `routes` map. The other
endpoints (`/matches`, `/match`, `/match-rounds`, `/player`, `/maps`,
`/versions`) are unchanged.

### Deletions

`endpoints/powerup.ts` and `endpoints/powerup-pickrate.ts` are removed
(subsumed by the factory).

### Tests

Replace `test/endpoints/powerup.test.ts` + `powerup-pickrate.test.ts` with a
single `test/endpoints/pick-analytics.test.ts` parameterized over the three
entities — mirrors the existing assertions (rows, 400-on-missing-id,
stats/co_offers/players envelope, zero-stats placeholder), adapted to the
neutral `id`/`other_id` columns.

## Shared types (`packages/shared/src/types.ts`)

Replace the `Powerup*` pickrate/detail types with neutral ones:

```ts
export type PickrateRow   = { id: string; times_offered: number; times_picked: number; pick_rate: number };
export type Pickrate      = { rows: PickrateRow[] };
export type PickKeyStats  = { id: string; rarity: string | null; times_offered: number; times_picked: number; pick_rate: number };
export type PickCoOfferRow= { other_id: string; co_offered: number; times_picked_target: number; times_picked_other: number };
export type PickPlayerRow = { player_id: string; times_offered: number; times_picked: number; pick_rate: number };
export type PickDetail    = { stats: PickKeyStats; co_offers: PickCoOfferRow[]; players: PickPlayerRow[] };
```

The match-detail feature's `PowerupOffer` / `RoundPowerupPick` / `TierWeight`
types are a **different** concern (per-round powerup picks inside a match)
and are left unchanged.

## Site (`site/src/`)

### Shared page components: `components/balance/`

- `PickratePage` — generic list page. Props: `title`, `label` (column
  header), the pickrate query result, and the detail route path. Renders the
  `DataTable` + `TimeRangePicker` + `UpdatedAt`.
- `PickDetailPage` — generic detail page. Props: `id`, `label`, list route
  path, detail route path, the detail query result, current `view`, and
  search-update navigators. Renders the stats card + co-offers/players tabs.

The TanStack `as any` route-typing casts stay co-located in the thin route
files (the components receive already-typed callbacks).

### Thin route files (per entity — TanStack needs one file per path)

`balance.powerups.tsx`, `balance.powerups.$id.tsx`, and the same for
`classes` and `weapons`. Each ~10–15 lines: define the `Route`
(`path`, `validateSearch`) and render the shared component with the entity's
label + endpoint path + hooks.

### Query hooks (`api/queries.ts`)

Generic `usePickrate(path, range)` and `usePickDetail(path, id, range)`
where `path` is the entity base (`"powerup"`/`"class"`/`"weapon"`). Replaces
`usePowerupPickrate` / `usePowerupDetail`.

### Routing + nav

- `router.tsx`: register the four new routes (classes, classes.$id, weapons,
  weapons.$id) beside the powerup ones.
- `__root.tsx`: add `Balance · Classes` and `Balance · Weapons` nav links.

## CLAUDE.md

Update the "Non-negotiable architecture rules" / "Code patterns" sections to
describe the pick-analytics family exception and the `PICK_ENTITIES`
add-an-entity workflow.

## handoff.md

The event-schema notes still name the old `class_selected` and omit the
weapon event. Update to `class_picked` + `weapon_picked`, and mention the new
`/class*` and `/weapon*` endpoints alongside the powerup ones.

## Verification

From the dashboard repo root: `pnpm typecheck && pnpm test && pnpm build`
(proxy in Miniflare, site in vitest + Vite build — the build step catches the
route-registration / Vite `base` class of error typecheck misses). Update the
site smoke test only if nav changes break it.

## Out of scope

- The game-side event rename (already shipped in the game repo).
- Any change to divergent endpoints or the match-detail powerup feature.
- Pushing to remote (commit on `main` locally only).
