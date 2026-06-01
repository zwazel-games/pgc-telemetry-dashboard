import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/matches.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

function stubDistincts(): void {
  // First two fetches in this test are for distincts; subsequent ones serve the /matches query.
  const responses = [
    new Response(JSON.stringify({ results: [["arena_a"]], columns: ["map_name"] })),
    new Response(JSON.stringify({ results: [["1.0.0"]], columns: ["game_version"] })),
  ];
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(responses.shift() ?? new Response("{}"))));
}

describe("GET /matches", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("rejects map not in allowlist", async () => {
    stubDistincts();
    const res = await handle(new Request("https://x.test/matches?map=unknown"), env, ctx);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; field?: string };
    expect(json.field).toBe("map");
  });

  it("returns envelope with matches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [["arena_a"]], columns: ["map_name"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [["1.0.0"]], columns: ["game_version"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["m1", "2026-05-01T00:00:00Z", "arena_a", 5, 4, 8, 60, "1.0.0", true]],
        columns: ["match_id", "started_at", "map", "rounds", "players", "max_players", "round_duration_s", "version", "is_steam"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/matches"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { matches: { match_id: string }[] } };
    expect(json.data.matches[0]?.match_id).toBe("m1");
  });
});
