import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/powerup-pickrate.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /powerup-pickrate", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["shield", 100, 30, 0.3]],
      columns: ["powerup", "times_offered", "times_picked", "pick_rate"],
    }))));

    const res = await handle(new Request("https://x.test/powerup-pickrate"), env, ctx);
    const json = await res.json() as { data: { rows: { powerup: string; pick_rate: number }[] } };
    expect(json.data.rows[0]?.powerup).toBe("shield");
    expect(json.data.rows[0]?.pick_rate).toBeCloseTo(0.3);
  });
});
