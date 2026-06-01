import { ApiHttpError } from "./errors.js";

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TWO_YEARS_MS = 2 * 365 * 86_400_000;

export function validateId(value: string | undefined, field: string): string {
  if (!value || !ID_RE.test(value)) {
    throw new ApiHttpError(400, { error: "invalid id", field });
  }
  return value;
}

export function validateTimeRange(
  since: string | undefined,
  until: string | undefined,
): { since: string; until: string } {
  const now = Date.now();
  const defaultSince = new Date(now - 30 * 86_400_000).toISOString();
  const defaultUntil = new Date(now).toISOString();

  const sinceIso = since ?? defaultSince;
  const untilIso = until ?? defaultUntil;

  const sinceTs = Date.parse(sinceIso);
  const untilTs = Date.parse(untilIso);
  if (Number.isNaN(sinceTs)) throw new ApiHttpError(400, { error: "invalid since", field: "since" });
  if (Number.isNaN(untilTs)) throw new ApiHttpError(400, { error: "invalid until", field: "until" });
  if (now - sinceTs > TWO_YEARS_MS) throw new ApiHttpError(400, { error: "since too old", field: "since" });
  if (untilTs < sinceTs) throw new ApiHttpError(400, { error: "until before since", field: "until" });

  return { since: new Date(sinceTs).toISOString(), until: new Date(untilTs).toISOString() };
}

export function validateAllowlisted<T extends string>(
  value: string | undefined,
  allowlist: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined || value === "") return undefined;
  if (!allowlist.includes(value as T)) {
    throw new ApiHttpError(400, { error: "value not allowed", field });
  }
  return value as T;
}
