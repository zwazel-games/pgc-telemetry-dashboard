import type { MatchRounds, PowerupOffer, RoundPlayerSummary, RoundPowerupPick, TierWeight } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

const SUMMARIES_SQL = `
SELECT properties.round          AS round,
       properties.player_id      AS player_id,
       properties.kills          AS kills,
       properties.deaths         AS deaths,
       properties.points_awarded AS points,
       properties.weapon         AS weapon,
       properties.class          AS class
FROM events
WHERE event = 'player_round_summary' AND properties.match_id = {match_id}
ORDER BY round ASC, points DESC
LIMIT 500
`;

// offered and tier_weights are JSON arrays-of-objects on PostHog. Selecting
// them directly returns a stringified shape that varies by upstream; using
// toString(...) gives us a stable JSON string that we parse on the Worker.
const PICKS_SQL = `
SELECT properties.round                  AS round,
       properties.player_id              AS player_id,
       properties.picked                 AS picked,
       toString(properties.offered)      AS offered_json,
       toString(properties.tier_weights) AS tier_weights_json
FROM events
WHERE event = 'powerup_picked' AND properties.match_id = {match_id}
ORDER BY round ASC
LIMIT 500
`;

type RawPick = {
  round: number;
  player_id: string;
  picked: string | null;
  offered_json: string | null;
  tier_weights_json: string | null;
};

function parseJsonArray<T>(s: string | null | undefined): T[] {
  if (!s || s === "null" || s === "") return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = validateId(url.searchParams.get("id") ?? undefined, "id");
    const values = { match_id: id };

    const [summaries, rawPicks] = await Promise.all([
      runQuery<RoundPlayerSummary>(env, SUMMARIES_SQL, values),
      runQuery<RawPick>(env, PICKS_SQL, values),
    ]);

    const picks: RoundPowerupPick[] = rawPicks.map((p) => ({
      round: p.round,
      player_id: p.player_id,
      picked: p.picked ?? "",
      offered: parseJsonArray<PowerupOffer>(p.offered_json),
      tier_weights: parseJsonArray<TierWeight>(p.tier_weights_json),
    }));

    const body: { data: MatchRounds; generated_at: string } = {
      data: { summaries, picks },
      generated_at: new Date().toISOString(),
    };
    return jsonResponse(body, 200, CACHE_S);
  } catch (e) {
    if (e instanceof ApiHttpError) return jsonError(e.body, e.status);
    throw e;
  }
}
