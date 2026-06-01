import type { PowerupDetail, PowerupKeyStats, PowerupCoOfferRow, PowerupPlayerRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId, validateTimeRange } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

// Each event has a per-offer array; arrayJoin unnests it, so each event becomes
// N rows (one per offered powerup). Filter to rows where the offered slot is
// our target powerup, then count and aggregate.
const STATS_SQL = `
SELECT
    {powerup}                                                 AS powerup,
    any(JSONExtractString(offer_json, 'rarity'))              AS rarity,
    count()                                                   AS times_offered,
    countIf(picked = {powerup})                               AS times_picked,
    countIf(picked = {powerup}) / count()                     AS pick_rate
FROM (
    SELECT
        properties.picked                                                                       AS picked,
        arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]')))              AS offer_json
    FROM events
    WHERE event = 'powerup_picked'
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
)
WHERE JSONExtractString(offer_json, 'id') = {powerup}
`;

// For each event whose offered set contained the target, expand the other
// offered powerups and aggregate by (other_powerup). count() = times the
// combo was offered; countIf gives how often the target vs the other was picked.
const CO_OFFERS_SQL = `
SELECT
    other_powerup,
    count()                          AS co_offered,
    countIf(picked = {powerup})      AS times_picked_target,
    countIf(picked = other_powerup)  AS times_picked_other
FROM (
    SELECT
        properties.picked                                                                       AS picked,
        JSONExtractString(arrayJoin(JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))), 'id') AS other_powerup
    FROM events
    WHERE event = 'powerup_picked'
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
      AND has(
          arrayMap(o -> JSONExtractString(o, 'id'), JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
          {powerup}
      )
)
WHERE other_powerup != {powerup}
GROUP BY other_powerup
ORDER BY co_offered DESC
LIMIT 50
`;

const PLAYERS_SQL = `
SELECT
    properties.player_id                                AS player_id,
    count()                                             AS times_offered,
    countIf(properties.picked = {powerup})              AS times_picked,
    countIf(properties.picked = {powerup}) / count()    AS pick_rate
FROM events
WHERE event = 'powerup_picked'
  AND timestamp >= toDateTime({since})
  AND timestamp <  toDateTime({until})
  AND has(
      arrayMap(o -> JSONExtractString(o, 'id'), JSONExtractArrayRaw(ifNull(toString(properties.offered), '[]'))),
      {powerup}
  )
GROUP BY player_id
ORDER BY times_offered DESC
LIMIT 200
`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = validateId(url.searchParams.get("id") ?? undefined, "id");
    const { since, until } = validateTimeRange(
      url.searchParams.get("since") ?? undefined,
      url.searchParams.get("until") ?? undefined,
    );
    const values = { powerup: id, since, until };

    const [statsRows, coOffers, players] = await Promise.all([
      runQuery<PowerupKeyStats>(env, STATS_SQL, values),
      runQuery<PowerupCoOfferRow>(env, CO_OFFERS_SQL, values),
      runQuery<PowerupPlayerRow>(env, PLAYERS_SQL, values),
    ]);

    const stats: PowerupKeyStats = statsRows[0] ?? {
      powerup: id,
      rarity: null,
      times_offered: 0,
      times_picked: 0,
      pick_rate: 0,
    };

    const body: { data: PowerupDetail; generated_at: string } = {
      data: { stats, co_offers: coOffers, players },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
