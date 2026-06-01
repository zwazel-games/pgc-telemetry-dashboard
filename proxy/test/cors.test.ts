import { describe, it, expect } from "vitest";
import { preflight, withCors } from "../src/cors.js";

describe("cors", () => {
  it("preflight returns 204 with allow headers", () => {
    const res = preflight("https://site.example");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("withCors adds allow-origin header", () => {
    const res = withCors(new Response("ok"), "https://site.example");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect(res.headers.get("vary")).toBe("Origin");
  });
});
