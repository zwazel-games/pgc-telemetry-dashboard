import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("404s on unknown route", async () => {
    const res = await SELF.fetch("https://example.com/unknown");
    expect(res.status).toBe(404);
  });
});
