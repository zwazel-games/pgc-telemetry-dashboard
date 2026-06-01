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
      AND timestamp >= toDateTime({since})
      AND timestamp <  toDateTime({until})
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
