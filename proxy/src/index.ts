import type { Env } from "./env.js";

export default {
  async fetch(_req: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
