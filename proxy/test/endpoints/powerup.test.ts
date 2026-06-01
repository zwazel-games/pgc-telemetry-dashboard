import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/powerup.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /powerup", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/powerup"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns stats, co_offers, players in one envelope", async () => {
    const fetchMock = vi.fn()
      // stats query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["shield", "rare", 100, 30, 0.3]],
        columns: ["powerup", "rarity", "times_offered", "times_picked", "pick_rate"],
      })))
      // co-offers query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["boost", 40, 10, 20]],
        columns: ["other_powerup", "co_offered", "times_picked_target", "times_picked_other"],
      })))
      // players query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["p1", 12, 5, 0.4167]],
        columns: ["player_id", "times_offered", "times_picked", "pick_rate"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/powerup?id=shield"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        stats: { powerup: string; rarity: string | null; pick_rate: number };
        co_offers: { other_powerup: string }[];
        players: { player_id: string }[];
      };
    };
    expect(json.data.stats.powerup).toBe("shield");
    expect(json.data.stats.rarity).toBe("rare");
    expect(json.data.stats.pick_rate).toBeCloseTo(0.3);
    expect(json.data.co_offers[0]?.other_powerup).toBe("boost");
    expect(json.data.players[0]?.player_id).toBe("p1");
  });

  it("returns zero-stats placeholder when no events match", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["powerup", "rarity", "times_offered", "times_picked", "pick_rate"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["other_powerup", "co_offered", "times_picked_target", "times_picked_other"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["player_id", "times_offered", "times_picked", "pick_rate"] })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/powerup?id=unknown_powerup"), env, ctx);
    const json = await res.json() as { data: { stats: { times_offered: number; rarity: string | null } } };
    expect(json.data.stats.times_offered).toBe(0);
    expect(json.data.stats.rarity).toBeNull();
  });
});
