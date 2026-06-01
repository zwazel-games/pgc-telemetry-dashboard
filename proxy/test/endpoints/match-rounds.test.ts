import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/match-rounds.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /match-rounds", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("400 when id missing", async () => {
    const res = await handle(new Request("https://x.test/match-rounds"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("returns summaries and parses offered/tier_weights JSON on the picks", async () => {
    const fetchMock = vi.fn()
      // summaries
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [[0, "p1", 3, 0, 10, "shotgun", "brawler"]],
        columns: ["round", "player_id", "kills", "deaths", "points", "weapon", "class"],
      })))
      // picks
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [[0, "p1", "high-jump",
          '[{"id":"swift","rarity":"common"},{"id":"high-jump","rarity":"common"}]',
          '[{"tier":"common","base_weight":100,"final_weight":115},{"tier":"rare","base_weight":10,"final_weight":11.5}]',
        ]],
        columns: ["round", "player_id", "picked", "offered_json", "tier_weights_json"],
      })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await handle(new Request("https://x.test/match-rounds?id=m1"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        summaries: { round: number; player_id: string; weapon: string }[];
        picks: { round: number; picked: string; offered: { id: string }[]; tier_weights: { tier: string; final_weight: number }[] }[];
      };
    };
    expect(json.data.summaries[0]?.weapon).toBe("shotgun");
    expect(json.data.picks[0]?.picked).toBe("high-jump");
    expect(json.data.picks[0]?.offered).toHaveLength(2);
    expect(json.data.picks[0]?.offered[0]?.id).toBe("swift");
    expect(json.data.picks[0]?.tier_weights[0]?.tier).toBe("common");
    expect(json.data.picks[0]?.tier_weights[0]?.final_weight).toBe(115);
  });

  it("returns empty arrays when no events match", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["round", "player_id", "kills", "deaths", "points", "weapon", "class"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["round", "player_id", "picked", "offered_json", "tier_weights_json"] }))),
    );

    const res = await handle(new Request("https://x.test/match-rounds?id=m_unknown"), env, ctx);
    const json = await res.json() as { data: { summaries: unknown[]; picks: unknown[] } };
    expect(json.data.summaries).toEqual([]);
    expect(json.data.picks).toEqual([]);
  });

  it("handles missing/null picked or offered JSON gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [], columns: ["round", "player_id", "kills", "deaths", "points", "weapon", "class"] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [[0, "p1", null, null, null]],
        columns: ["round", "player_id", "picked", "offered_json", "tier_weights_json"],
      }))),
    );

    const res = await handle(new Request("https://x.test/match-rounds?id=m1"), env, ctx);
    const json = await res.json() as { data: { picks: { picked: string; offered: unknown[]; tier_weights: unknown[] }[] } };
    expect(json.data.picks[0]?.picked).toBe("");
    expect(json.data.picks[0]?.offered).toEqual([]);
    expect(json.data.picks[0]?.tier_weights).toEqual([]);
  });
});
