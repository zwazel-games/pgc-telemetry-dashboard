import { describe, it, expect } from "vitest";
import { ApiHttpError, jsonResponse } from "../src/errors.js";

describe("errors", () => {
  it("ApiHttpError carries status and body", () => {
    const e = new ApiHttpError(400, { error: "bad", field: "id" });
    expect(e.status).toBe(400);
    expect(e.body).toEqual({ error: "bad", field: "id" });
  });

  it("jsonResponse sets content-type and serializes envelope", async () => {
    const res = jsonResponse({ data: { x: 1 }, generated_at: "2026-01-01T00:00:00Z" }, 200, 60);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await res.json()).toEqual({ data: { x: 1 }, generated_at: "2026-01-01T00:00:00Z" });
  });
});
