import type { VersionsResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { getVersions } from "../distincts.js";
import { jsonResponse } from "../errors.js";

const CACHE_S = 60;

export async function handle(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const versions = await getVersions(env);
  const body: { data: VersionsResponse; generated_at: string } = {
    data: { versions },
    generated_at: new Date().toISOString(),
  };
  return jsonResponse(body, 200, CACHE_S);
}
