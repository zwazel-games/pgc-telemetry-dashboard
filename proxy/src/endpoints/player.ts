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
