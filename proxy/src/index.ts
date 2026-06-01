import type { Env } from "./env.js";
import * as matches from "./endpoints/matches.js";
import * as match from "./endpoints/match.js";
import * as player from "./endpoints/player.js";
import * as powerupPickrate from "./endpoints/powerup-pickrate.js";
import * as maps from "./endpoints/maps.js";
import * as versions from "./endpoints/versions.js";
import { preflight, withCors } from "./cors.js";
import { cacheJson } from "./cache.js";
import { jsonError } from "./errors.js";

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/matches": matches.handle,
  "/match": match.handle,
  "/player": player.handle,
  "/powerup-pickrate": powerupPickrate.handle,
  "/maps": maps.handle,
  "/versions": versions.handle,
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN;

    if (req.method === "OPTIONS") return preflight(origin);

    const url = new URL(req.url);
    const handler = routes[url.pathname];
    if (!handler) {
      return withCors(jsonError({ error: "not_found" }, 404), origin);
    }

    try {
      const res = await cacheJson(req, ctx, () => handler(req, env, ctx));
      return withCors(res, origin);
    } catch (err) {
      console.error("handler error", err);
      return withCors(jsonError({ error: "internal" }, 500), origin);
    }
  },
} satisfies ExportedHandler<Env>;
