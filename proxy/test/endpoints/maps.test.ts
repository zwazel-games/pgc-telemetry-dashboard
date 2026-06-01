import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/maps.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /maps", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("returns envelope with maps array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["arena_a"], ["arena_b"]], columns: ["map_name"] })),
    ));
    const res = await handle(new Request("https://x.test/maps"), env, ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { maps: string[] }; generated_at: string };
    expect(json.data.maps).toEqual(["arena_a", "arena_b"]);
    expect(typeof json.generated_at).toBe("string");
  });
});
