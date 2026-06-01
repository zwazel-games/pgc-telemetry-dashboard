import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/match.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /match", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/match"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("400 when id contains illegal chars", async () => {
    const res = await handle(new Request("https://x.test/match?id=hi+there"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns overview + scoreboard", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["arena_a", 5, 4, 8, 60, "1.0.0"]],
        columns: ["map", "rounds", "players", "max_players", "round_s", "version"],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["p1", 10, 4, 200]],
        columns: ["player_id", "kills", "deaths", "points"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/match?id=m1"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { overview: { map: string } | null; scoreboard: { player_id: string }[] } };
    expect(json.data.overview?.map).toBe("arena_a");
    expect(json.data.scoreboard[0]?.player_id).toBe("p1");
  });
});
