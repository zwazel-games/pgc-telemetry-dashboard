import { describe, it, expect } from "vitest";
import { validateId, validateTimeRange, validateAllowlisted } from "../src/validate.js";
import { ApiHttpError } from "../src/errors.js";

describe("validate", () => {
  describe("validateId", () => {
    it("accepts a safe id", () => {
      expect(validateId("abc_123-XYZ", "match_id")).toBe("abc_123-XYZ");
    });
    it("rejects empty", () => {
      expect(() => validateId("", "match_id")).toThrow(ApiHttpError);
    });
    it("rejects characters outside A-Z 0-9 _ -", () => {
      expect(() => validateId("ab cd", "match_id")).toThrow(ApiHttpError);
      expect(() => validateId("ab;DROP", "match_id")).toThrow(ApiHttpError);
    });
    it("rejects > 128 chars", () => {
      expect(() => validateId("a".repeat(129), "match_id")).toThrow(ApiHttpError);
    });
  });

  describe("validateTimeRange", () => {
    it("defaults to last 30 days when both missing", () => {
      const { since, until } = validateTimeRange(undefined, undefined);
      expect(new Date(until).getTime() - new Date(since).getTime())
        .toBeGreaterThan(29 * 86_400_000);
    });
    it("rejects unparseable ISO", () => {
      expect(() => validateTimeRange("not-a-date", undefined)).toThrow(ApiHttpError);
    });
    it("rejects > 2 years old", () => {
      expect(() => validateTimeRange("2000-01-01T00:00:00Z", undefined)).toThrow(ApiHttpError);
    });
  });

  describe("validateAllowlisted", () => {
    it("returns undefined when value missing", () => {
      expect(validateAllowlisted(undefined, ["a"], "map")).toBeUndefined();
    });
    it("returns value when present in allowlist", () => {
      expect(validateAllowlisted("a", ["a", "b"], "map")).toBe("a");
    });
    it("throws when not in allowlist", () => {
      expect(() => validateAllowlisted("c", ["a", "b"], "map")).toThrow(ApiHttpError);
    });
  });
});
