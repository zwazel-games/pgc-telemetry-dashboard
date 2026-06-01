// Wire envelope
export type ApiEnvelope<T> = { data: T; generated_at: string };
export type ApiError = { error: string; field?: string };

// Filters
export type TimeRange = { since?: string; until?: string };

// /matches
export type MatchesRequest = TimeRange & { map?: string; version?: string };
export type Match = {
  match_id: string;
  started_at: string;
  map: string;
  rounds: number;
  players: number;
  max_players: number;
  round_duration_s: number;
  version: string;
  is_steam: boolean;
};
export type MatchesResponse = { matches: Match[] };

// /match?id=
export type MatchOverview = {
  map: string;
  rounds: number;
  players: number;
  max_players: number;
  round_s: number;
  version: string;
  is_steam: boolean;
};
export type ScoreboardRow = {
  player_id: string;
  kills: number;
  deaths: number;
  points: number;
};
export type MatchDetail = {
  overview: MatchOverview | null;
  scoreboard: ScoreboardRow[];
};

// /player?id=
export type PlayerMatchRow = {
  match_id: string;
  played_at: string;
  rounds_seen: number;
};
export type PlayerHistory = { matches: PlayerMatchRow[] };

// /powerup-pickrate
export type PowerupPickrateRow = {
  powerup: string;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PowerupPickrate = { rows: PowerupPickrateRow[] };

// /maps, /versions
export type MapsResponse = { maps: string[] };
export type VersionsResponse = { versions: string[] };
