import type { MapsResponse } from "@pgc/shared";
import type { Env } from "../env.js";
import { getMaps } from "../distincts.js";
import { jsonResponse } from "../errors.js";

const CACHE_S = 60;

export async function handle(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const maps = await getMaps(env);
  const body: { data: MapsResponse; generated_at: string } = {
    data: { maps },
    generated_at: new Date().toISOString(),
  };
  return jsonResponse(body, 200, CACHE_S);
}
