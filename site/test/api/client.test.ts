import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiClientError } from "../../src/api/client.js";

describe("api()", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns data from envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { maps: ["a"] }, generated_at: "t" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    const data = await api<{ maps: string[] }>("/maps");
    expect(data).toEqual({ maps: ["a"] });
  });

  it("appends defined query params, skips undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { matches: [] }, generated_at: "t" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await api("/matches", { since: "2026-01-01T00:00:00Z", map: undefined });
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain("since=2026-01-01");
    expect((fetchMock.mock.calls[0]?.[0] as string)).not.toContain("map=");
  });

  it("throws ApiClientError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad", field: "id" }), { status: 400 }),
    ));
    await expect(api("/match", { id: "" })).rejects.toMatchObject({
      status: 400,
      body: { error: "bad", field: "id" },
    });
  });
});
