import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../../src/endpoints/versions.js";
import { _resetDistinctsCacheForTests } from "../../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };
const ctx = { waitUntil() {} } as unknown as ExecutionContext;

describe("GET /versions", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("returns envelope with versions array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["1.0.1"], ["1.0.0"]], columns: ["game_version"] })),
    ));
    const res = await handle(new Request("https://x.test/versions"), env, ctx);
    const json = await res.json() as { data: { versions: string[] } };
    expect(json.data.versions).toEqual(["1.0.1", "1.0.0"]);
  });
});
