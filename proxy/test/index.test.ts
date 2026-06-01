import { SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("router", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("OPTIONS preflight responds 204 with allowed origin", async () => {
    const res = await SELF.fetch("https://worker.test/matches", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("returns 404 with JSON for unknown path", async () => {
    const res = await SELF.fetch("https://worker.test/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("adds CORS headers on real responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [["arena_a"]], columns: ["map_name"],
    }))));
    const res = await SELF.fetch("https://worker.test/maps");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("returns 500 generic error when handler throws (does not leak upstream)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("posthog raw error body", { status: 500 })));
    const res = await SELF.fetch("https://worker.test/maps");
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("internal");
    expect(JSON.stringify(json)).not.toContain("posthog raw");
  });
});
