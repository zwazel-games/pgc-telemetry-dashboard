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
`;

const VERSIONS_SQL = `
SELECT DISTINCT properties.game_version AS game_version
FROM events
WHERE event = 'match_started' AND notEmpty(toString(properties.game_version))
ORDER BY game_version DESC
`;

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
  const value = rows.map((r) => r.game_version);
  versionsCache = { value, at: Date.now() };
  return value;
}

export function _resetDistinctsCacheForTests(): void {
  mapsCache = null;
  versionsCache = null;
}
