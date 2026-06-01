import { describe, it, expect, vi, beforeEach } from "vitest";
import { runQuery } from "../src/posthog.js";

const fakeEnv = { POSTHOG_API_KEY: "phx_test", ALLOWED_ORIGIN: "x" };

describe("runQuery", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the EU query endpoint with bearer auth and parameterized HogQL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [["a", 1]], columns: ["x", "y"] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await runQuery<{ x: string; y: number }>(fakeEnv, "SELECT * WHERE id = {id}", { id: "abc" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://eu.posthog.com/api/projects/189316/query/");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer phx_test",
      "content-type": "application/json",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: { kind: "HogQLQuery", query: "SELECT * WHERE id = {id}", values: { id: "abc" } },
    });
    expect(rows).toEqual([{ x: "a", y: 1 }]);
  });

  it("throws UpstreamError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    await expect(runQuery(fakeEnv, "SELECT 1", {})).rejects.toThrow(/upstream/i);
  });
});
