import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiEnvelope, ApiClientError } from "../../src/api/client.js";

describe("apiEnvelope()", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns full envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { maps: ["a"] }, generated_at: "t" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    const env = await apiEnvelope<{ maps: string[] }>("/maps");
    expect(env.data).toEqual({ maps: ["a"] });
    expect(env.generated_at).toBe("t");
  });

  it("appends defined query params, skips undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { matches: [] }, generated_at: "t" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiEnvelope("/matches", { since: "2026-01-01T00:00:00Z", map: undefined });
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain("since=2026-01-01");
    expect((fetchMock.mock.calls[0]?.[0] as string)).not.toContain("map=");
  });

  it("throws ApiClientError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "bad", field: "id" }), { status: 400 }),
    ));
    await expect(apiEnvelope("/match", { id: "" })).rejects.toMatchObject({
      status: 400,
      body: { error: "bad", field: "id" },
    });
  });
});
