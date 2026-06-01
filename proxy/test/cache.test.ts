import { describe, it, expect, vi } from "vitest";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { cacheJson } from "../src/cache.js";

describe("cacheJson", () => {
  it("calls handler on first hit, returns cached response on second", async () => {
    const url = "https://x.test/matches?since=A";
    const ctx = createExecutionContext();
    const handler = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: 1 }), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
        }),
      ),
    );

    const first = await cacheJson(new Request(url), ctx, handler);
    expect(first.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();

    // Flush waitUntil tasks (cache.put) before the second request
    await waitOnExecutionContext(ctx);

    const second = await cacheJson(new Request(url), ctx, handler);
    expect(second.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
