import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMaps, getVersions, _resetDistinctsCacheForTests } from "../src/distincts.js";

const env = { POSTHOG_API_KEY: "x", ALLOWED_ORIGIN: "y" };

describe("distincts", () => {
  beforeEach(() => {
    _resetDistinctsCacheForTests();
    vi.unstubAllGlobals();
  });

  it("getMaps returns map_name list, cached on second call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["arena_a"], ["arena_b"]], columns: ["map_name"] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getMaps(env)).toEqual(["arena_a", "arena_b"]);
    expect(await getMaps(env)).toEqual(["arena_a", "arena_b"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("getVersions returns version list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["1.0.0"], ["1.0.1"]], columns: ["game_version"] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getVersions(env)).toEqual(["1.0.0", "1.0.1"]);
  });
});
