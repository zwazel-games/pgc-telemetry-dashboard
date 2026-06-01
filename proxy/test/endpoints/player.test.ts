import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/player.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /player", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/player"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns matches list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["m1", "2026-05-01T00:00:00Z", 5]],
      columns: ["match_id", "played_at", "rounds_seen"],
    }))));

    const res = await handle(new Request("https://x.test/player?id=p1"), env, ctx);
    const json = await res.json() as { data: { matches: { match_id: string }[] } };
    expect(json.data.matches[0]?.match_id).toBe("m1");
  });
});
