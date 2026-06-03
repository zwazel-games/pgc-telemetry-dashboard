import type { Env } from "./env.js";
import { runQuery } from "./posthog.js";

const TTL_MS = 5 * 60_000;

type Cached<T> = { value: T; at: number };
let mapsCache: Cached<string[]> | null = null;
let versionsCache: Cached<string[]> | null = null;

const MAPS_SQL = `
SELECT DISTINCT properties.map_name AS map_name
FROM events
WHERE event = 'match_started' AND notEmpty(toString(properties.map_name))
ORDER BY map_name
LIMIT 500
`;

const VERSIONS_SQL = `
SELECT DISTINCT properties.game_version AS game_version
FROM events
WHERE event = 'match_started' AND notEmpty(toString(properties.game_version))
LIMIT 500
`;

// game_version is CARGO_PKG_VERSION — numeric semver "MAJOR.MINOR.PATCH"
// (e.g. "0.3.9", "0.3.13", "0.4.0"). A plain string ORDER BY misorders these
// ("0.3.9" > "0.3.13" lexicographically), so sort numerically here instead —
// this is the single source both the version dropdown order and the
// "latest version" default (versions[0]) rely on. Result is newest-first.
//
// Each component: missing (fewer than 3 parts) counts as 0; non-numeric
// counts as -1 so a malformed version sorts after well-formed ones.
function versionComponent(parts: string[], i: number): number {
  const raw = parts[i];
  if (raw === undefined) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? -1 : n;
}

export function compareGameVersionsDesc(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = versionComponent(pb, i) - versionComponent(pa, i);
    if (diff !== 0) return diff;
  }
  return b.localeCompare(a); // stable, deterministic tiebreak
}

export async function getMaps(env: Env): Promise<string[]> {
  if (mapsCache && Date.now() - mapsCache.at < TTL_MS) return mapsCache.value;
  const rows = await runQuery<{ map_name: string }>(env, MAPS_SQL, {});
  const value = rows.map((r) => r.map_name);
  mapsCache = { value, at: Date.now() };
  return value;
}

export async function getVersions(env: Env): Promise<string[]> {
  if (versionsCache && Date.now() - versionsCache.at < TTL_MS) return versionsCache.value;
  const rows = await runQuery<{ game_version: string }>(env, VERSIONS_SQL, {});
  const value = rows.map((r) => r.game_version).sort(compareGameVersionsDesc);
  versionsCache = { value, at: Date.now() };
  return value;
}

export function _resetDistinctsCacheForTests(): void {
  mapsCache = null;
  versionsCache = null;
}
