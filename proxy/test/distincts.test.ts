import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMaps, getVersions, compareGameVersionsDesc, _resetDistinctsCacheForTests } from "../src/distincts.js";

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

  it("getVersions returns versions newest-first (semver, not lexicographic)", async () => {
    // Lexicographically "0.3.9" > "0.3.13" > "0.10.0"; the correct semver
    // order is the reverse. PostHog may return them in any order.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        results: [["0.3.9"], ["0.10.0"], ["0.4.0"], ["0.3.13"]],
        columns: ["game_version"],
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getVersions(env)).toEqual(["0.10.0", "0.4.0", "0.3.13", "0.3.9"]);
  });
});

describe("compareGameVersionsDesc", () => {
  it("orders by numeric semver components, newest first", () => {
    const sorted = ["1.2.0", "1.10.0", "1.9.0", "2.0.0", "1.10.2"].sort(compareGameVersionsDesc);
    expect(sorted).toEqual(["2.0.0", "1.10.2", "1.10.0", "1.9.0", "1.2.0"]);
  });

  it("treats missing components as 0 and malformed components as lowest", () => {
    const sorted = ["1.2", "1.2.0", "1.2.1", "1.2.x"].sort(compareGameVersionsDesc);
    // "1.2" == "1.2.0" numerically (tiebreak by string); "1.2.x" sorts last.
    expect(sorted).toEqual(["1.2.1", "1.2.0", "1.2", "1.2.x"]);
  });
});
