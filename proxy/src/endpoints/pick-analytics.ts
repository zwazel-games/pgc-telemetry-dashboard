// Shared "pick-analytics" family. The `*_picked` telemetry events (powerup,
// class, weapon) are structurally identical — each carries an `offered` JSON
// array of `{id, rarity}`, a `picked` id, and `player_id` — so one
// parameterized builder serves all three pickrate + detail endpoints.
//
// The per-entity difference is just the hardcoded `event` name interpolated
// into the SQL. That name is NEVER user-supplied (it comes from the
// PICK_ENTITIES table below), so the "Worker is not a SQL passthrough" rule
// still holds: user input flows only through {since}/{until}/{id}
// placeholders via runQuery. Output columns are neutral: `id`, `other_id`,
// `player_id`.
import type { Pickrate, PickrateRow, PickDetail, PickKeyStats, PickCoOfferRow, PickPlayerRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId, validateTimeRange } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

const pickrateSql = (event: string) => `
SELECT
    id,
    count()                        AS times_offered,
    countIf(picked = id)           AS times_picked,
    countIf(picked = id) / count() AS pick_rate
FROM (
    SELECT
        properties.picked AS picked,
        JSONExtractString(
            arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
            'id'
        ) AS id
    FROM events
    WHERE event = '${event}'
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
)
GROUP BY id
ORDER BY pick_rate DESC
LIMIT 200
`;

// Each event has a per-offer array; arrayJoin unnests it, so each event becomes
// N rows (one per offered entry). Filter to rows where the offered slot is our
// target id, then count and aggregate.
const statsSql = (event: string) => `
SELECT
    {id}                                         AS id,
    any(JSONExtractString(offer_json, 'rarity')) AS rarity,
    count()                                      AS times_offered,
    countIf(picked = {id})                       AS times_picked,
    countIf(picked = {id}) / count()             AS pick_rate
FROM (
    SELECT
        properties.picked                                                          AS picked,
        arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))) AS offer_json
    FROM events
    WHERE event = '${event}'
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
)
WHERE JSONExtractString(offer_json, 'id') = {id}
`;

// For each event whose offered set contained the target, expand the other
// offered entries and aggregate by (other_id). count() = times the combo was
// offered; countIf gives how often the target vs the other was picked.
const coOffersSql = (event: string) => `
SELECT
    other_id,
    count()                          AS co_offered,
    countIf(picked = {id})           AS times_picked_target,
    countIf(picked = other_id)       AS times_picked_other
FROM (
    SELECT
        properties.picked                                                                                   AS picked,
        JSONExtractString(arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))), 'id') AS other_id
    FROM events
    WHERE event = '${event}'
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
      AND has(
          arrayMap(o -> JSONExtractString(o, 'id'), JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
          {id}
      )
)
WHERE other_id != {id}
GROUP BY other_id
ORDER BY co_offered DESC
LIMIT 50
`;

const playersSql = (event: string) => `
SELECT
    properties.player_id                          AS player_id,
    count()                                        AS times_offered,
    countIf(properties.picked = {id})              AS times_picked,
    countIf(properties.picked = {id}) / count()    AS pick_rate
FROM events
WHERE event = '${event}'
  AND timestamp >= toDateTime({since})
  AND timestamp <  toDateTime({until})
  AND has(
      arrayMap(o -> JSONExtractString(o, 'id'), JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
      {id}
  )
GROUP BY player_id
ORDER BY times_offered DESC
LIMIT 200
`;

/** `/<entity>-pickrate` handler for the given `*_picked` event. */
export function makePickrateHandler(event: string): Handler {
  const SQL = pickrateSql(event);
  return async (req, env, _ctx) => {
    try {
      const url = new URL(req.url);
      const { since, until } = validateTimeRange(
        url.searchParams.get("since") ?? undefined,
        url.searchParams.get("until") ?? undefined,
      );
      const rows = await runQuery<PickrateRow>(env, SQL, { since, until });
      const body: { data: Pickrate; generated_at: string } = {
        data: { rows },
        generated_at: new Date().toISOString(),
      };
      return jsonResponse(body, 200, CACHE_S);
    } catch (e) {
      if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
      throw e;
    }
  };
}

/** `/<entity>?id=` detail handler (stats + co-offers + players). */
export function makeDetailHandler(event: string): Handler {
  const STATS_SQL = statsSql(event);
  const CO_OFFERS_SQL = coOffersSql(event);
  const PLAYERS_SQL = playersSql(event);
  return async (req, env, _ctx) => {
    try {
      const url = new URL(req.url);
      const id = validateId(url.searchParams.get("id") ?? undefined, "id");
      const { since, until } = validateTimeRange(
        url.searchParams.get("since") ?? undefined,
        url.searchParams.get("until") ?? undefined,
      );
      const values = { id, since, until };

      const [statsRows, coOffers, players] = await Promise.all([
        runQuery<PickKeyStats>(env, STATS_SQL, values),
        runQuery<PickCoOfferRow>(env, CO_OFFERS_SQL, values),
        runQuery<PickPlayerRow>(env, PLAYERS_SQL, values),
      ]);

      const stats: PickKeyStats = statsRows[0] ?? {
        id,
        rarity: null,
        times_offered: 0,
        times_picked: 0,
        pick_rate: 0,
      };

      const body: { data: PickDetail; generated_at: string } = {
        data: { stats, co_offers: coOffers, players },
        generated_at: new Date().toISOString(),
      };
      return jsonResponse(body, 200, CACHE_S);
    } catch (e) {
      if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
      throw e;
    }
  };
}

/**
 * The pick-analytics entities. Adding a new `*_picked` event to the dashboard
 * is one entry here — no new files. `path` is the URL base; `event` is the
 * PostHog event name interpolated into the (hardcoded) SQL.
 */
export const PICK_ENTITIES: ReadonlyArray<{ path: string; event: string }> = [
  { path: "powerup", event: "powerup_picked" },
  { path: "class", event: "class_picked" },
  { path: "weapon", event: "weapon_picked" },
];

/** Route map fragment: `/<path>` → detail, `/<path>-pickrate` → pickrate. */
export const pickAnalyticsRoutes: Record<string, Handler> = Object.fromEntries(
  PICK_ENTITIES.flatMap(({ path, event }) => [
    [`/${path}`, makeDetailHandler(event)],
    [`/${path}-pickrate`, makePickrateHandler(event)],
  ]),
);
