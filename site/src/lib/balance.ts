// Shared URL-search shapes + validators for the balance pick-analytics routes
// (powerups / classes / weapons). Each entity's route file reuses these so the
// preset/since/until/view handling stays identical across the family.

export type Preset = "7d" | "30d" | "90d";
export type PickrateSearch = { preset: Preset; since?: string; until?: string };
export type DetailView = "co-offers" | "players";
export type DetailSearch = PickrateSearch & { view: DetailView };

const DEFAULT_DAYS = 30;

export function defaultRange(): { since: string; until: string } {
  const now = Date.now();
  return {
    since: new Date(now - DEFAULT_DAYS * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export function validatePickrateSearch(raw: Record<string, unknown>): PickrateSearch {
  const def = defaultRange();
  return {
    preset: raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d",
    since: typeof raw.since === "string" ? raw.since : def.since,
    until: typeof raw.until === "string" ? raw.until : def.until,
  };
}

export function validateDetailSearch(raw: Record<string, unknown>): DetailSearch {
  return {
    ...validatePickrateSearch(raw),
    view: raw.view === "players" ? "players" : "co-offers",
  };
}
