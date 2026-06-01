import type { MatchDetail, MatchOverview, ScoreboardRow } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { validateId } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";

const CACHE_S = 60;

const OVERVIEW_SQL = `
SELECT properties.map_name AS map, properties.total_rounds AS rounds,
       properties.player_count AS players, properties.max_players AS max_players,
       properties.round_duration_secs AS round_s, properties.game_version AS version,
       properties.is_steam AS is_steam
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
