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
