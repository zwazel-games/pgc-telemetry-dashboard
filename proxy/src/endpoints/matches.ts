import type { Match, MatchesResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { runQuery } from "../posthog.js";
import { getMaps, getVersions } from "../distincts.js";
import { validateTimeRange, validateAllowlisted } from "../validate.js";
import { ApiHttpError, jsonResponse, jsonError } from "../errors.js";
import { STATUS_SQL, ENDED_JOIN, statusFilterSql } from "./match-status.js";

const CACHE_S = 60;
const LIMIT = 500;

// Inner subquery: pull match_started rows with the user-supplied filters
// applied. Conditional clauses are appended at runtime.
const INNER_HEAD = `
SELECT
    properties.match_id             AS match_id,
    timestamp                       AS started_at,
    properties.map_name             AS map,
    properties.total_rounds         AS rounds,
    properties.player_count         AS players,
    properties.max_players          AS max_players,
    properties.round_duration_secs  AS round_duration_s,
    properties.game_version         AS version,
    properties.is_steam             AS is_steam
FROM events
WHERE event = 'match_started'
  AND timestamp >= toDateTime({since})
  AND timestamp <  toDateTime({until})
`;

// Outer wrap: LEFT JOIN with per-match rounds_played computed from the
// max player_round_summary.round, plus the match_ended reason (ENDED_JOIN).
// coalesce keeps the result a number even when a match has no recorded round
// summaries (player started then quit). rounds itself is coalesced to 0 to
// handle older events that didn't carry total_rounds. `status` is derived from
// match_ended.reason with a rounds-played fallback — see match-status.ts.
const OUTER_HEAD = `
SELECT
    m.match_id              AS match_id,
    m.started_at            AS started_at,
    m.map                   AS map,
    coalesce(m.rounds, 0)   AS rounds,
    coalesce(rp.rounds_played, 0) AS rounds_played,
    m.players               AS players,
    m.max_players           AS max_players,
    m.round_duration_s      AS round_duration_s,
    m.version               AS version,
    m.is_steam              AS is_steam,
    ${STATUS_SQL}           AS status
FROM (
`;

const OUTER_JOIN = `
) m
LEFT JOIN (
    SELECT properties.match_id AS match_id, max(properties.round) + 1 AS rounds_played
    FROM events
    WHERE event = 'player_round_summary'
    GROUP BY match_id
) rp ON m.match_id = rp.match_id
${ENDED_JOIN}`;

export async function handle(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(req.url);
    const { since, until } = validateTimeRange(
      url.searchParams.get("since") ?? undefined,
      url.searchParams.get("until") ?? undefined,
    );
    const [maps, versions] = await Promise.all([getMaps(env), getVersions(env)]);
    const map = validateAllowlisted(url.searchParams.get("map") ?? undefined, maps, "map");
    const version = validateAllowlisted(url.searchParams.get("version") ?? undefined, versions, "version");
    const platform = validateAllowlisted(url.searchParams.get("platform") ?? undefined, ["steam", "non-steam"] as const, "platform");
    // Default to finished-only so the matches list isn't polluted by the
    // user's own aborted/in-progress test sessions. Pass ?status=in_progress,
    // ?status=aborted, or ?status=all to widen.
    const status =
      validateAllowlisted(
        url.searchParams.get("status") ?? "finished",
        ["finished", "in_progress", "aborted", "all"] as const,
        "status",
      ) ?? "all";

    let inner = INNER_HEAD;
    const values: Record<string, string | number> = { since, until };
    if (map !== undefined)     { inner += "  AND properties.map_name     = {map}\n";     values.map = map; }
    if (version !== undefined) { inner += "  AND properties.game_version = {version}\n"; values.version = version; }
    if (platform !== undefined) {
      inner += "  AND properties.is_steam = {is_steam}\n";
      values.is_steam = platform === "steam" ? 1 : 0;
    }

    // Outer WHERE: applied after the JOINs so the status predicate can see
    // both the rounds heuristic and the match_ended reason. Kept consistent
    // with STATUS_SQL via statusFilterSql().
    let outerWhere = "WHERE 1=1\n";
    const statusPredicate = statusFilterSql(status);
    if (statusPredicate !== null) outerWhere += `  AND ${statusPredicate}\n`;

    const sql = OUTER_HEAD + inner + OUTER_JOIN + outerWhere + `ORDER BY started_at DESC LIMIT ${LIMIT}`;

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
