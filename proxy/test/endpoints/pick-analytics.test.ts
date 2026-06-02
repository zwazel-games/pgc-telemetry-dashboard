import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePickrateHandler, makeDetailHandler, PICK_ENTITIES, pickAnalyticsRoutes } from "../../src/endpoints/pick-analytics.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

// One event name per family member; the handler logic is identical, so we
// parameterize over them to prove the factory wires each correctly.
const EVENTS = ["powerup_picked", "class_picked", "weapon_picked"];

describe("pick-analytics: routes", () => {
  it("registers /<entity> and /<entity>-pickrate for every entity", () => {
    for (const { path } of PICK_ENTITIES) {
      expect(pickAnalyticsRoutes[`/${path}`]).toBeTypeOf("function");
      expect(pickAnalyticsRoutes[`/${path}-pickrate`]).toBeTypeOf("function");
    }
  });
});

describe.each(EVENTS)("pick-analytics pickrate (%s)", (event) => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["shield", 100, 30, 0.3]],
      columns: ["id", "times_offered", "times_picked", "pick_rate"],
    }))));

    const handle = makePickrateHandler(event);
    const res = await handle(new Request("https://x.test/pickrate"), env, ctx);
    const json = await res.json() as { data: { rows: { id: string; pick_rate: number }[] } };
    expect(json.data.rows[0]?.id).toBe("shield");
    expect(json.data.rows[0]?.pick_rate).toBeCloseTo(0.3);
  });
});

describe.each(EVENTS)("pick-analytics detail (%s)", (event) => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const handle = makeDetailHandler(event);
    const res = await handle(new Request("https://x.test/detail"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns stats, co_offers, players in one envelope", async () => {
    const fetchMock = vi.fn()
      // stats query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["shield", "rare", 100, 30, 0.3]],
        columns: ["id", "rarity", "times_offered", "times_picked", "pick_rate"],
      })))
      // co-offers query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["boost", 40, 10, 20]],
        columns: ["other_id", "co_offered", "times_picked_target", "times_picked_other"],
      })))
      // players query
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [["p1", 12, 5, 0.4167]],
        columns: ["player_id", "times_offered", "times_picked", "pick_rate"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const handle = makeDetailHandler(event);
    const res = await handle(new Request("https://x.test/detail?id=shield"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        stats: { id: string; rarity: string | null; pick_rate: number };
        co_offers: { other_id: string }[];
        players: { player_id: string }[];
      };
    };
    expect(json.data.stats.id).toBe("shield");
    expect(json.data.stats.rarity).toBe("rare");
    expect(json.data.stats.pick_rate).toBeCloseTo(0.3);
    expect(json.data.co_offers[0]?.other_id).toBe("boost");
    expect(json.data.players[0]?.player_id).toBe("p1");
  });

  it("returns zero-stats placeholder when no events match", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["id", "rarity", "times_offered", "times_picked", "pick_rate"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["other_id", "co_offered", "times_picked_target", "times_picked_other"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["player_id", "times_offered", "times_picked", "pick_rate"] })));
    vi.stubGlobal("fetch", fetchMock);

    const handle = makeDetailHandler(event);
    const res = await handle(new Request("https://x.test/detail?id=unknown"), env, ctx);
    const json = await res.json() as { data: { stats: { times_offered: number; rarity: string | null } } };
    expect(json.data.stats.times_offered).toBe(0);
    expect(json.data.stats.rarity).toBeNull();
  });
});
