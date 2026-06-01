// Wire envelope
export type ApiEnvelope<T> = { data: T; generated_at: string };
export type ApiError = { error: string; field?: string };

// Filters
export type TimeRange = { since?: string; until?: string };

// /matches
export type Platform = "steam" | "non-steam";
export type MatchesRequest = TimeRange & { map?: string; version?: string; platform?: Platform };
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
export type PlayerFinalInventory = {
  player_id: string;
  powerups: string[]; // all `picked` ids for this player+match, in pick order
};
export type MatchDetail = {
  overview: MatchOverview | null;
  scoreboard: ScoreboardRow[];
  inventories: PlayerFinalInventory[];
};

// /match-rounds?id=
export type RoundPlayerSummary = {
  round: number; // 0-indexed
  player_id: string;
  kills: number;
  deaths: number;
  points: number;
  weapon: string;
  class: string;
};
export type PowerupOffer = { id: string; rarity: string };
export type TierWeight = { tier: string; base_weight: number; final_weight: number };
export type RoundPowerupPick = {
  round: number; // 0-indexed; picks fire after each round except the last
  player_id: string;
  picked: string; // "" if the player didn't pick
  offered: PowerupOffer[];
  tier_weights: TierWeight[];
};
export type MatchRounds = {
  summaries: RoundPlayerSummary[];
  picks: RoundPowerupPick[];
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

// /powerup?id=
export type PowerupKeyStats = {
  powerup: string;
  rarity: string | null;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PowerupCoOfferRow = {
  other_powerup: string;
  co_offered: number;
  times_picked_target: number;
  times_picked_other: number;
};
export type PowerupPlayerRow = {
  player_id: string;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PowerupDetail = {
  stats: PowerupKeyStats;
  co_offers: PowerupCoOfferRow[];
  players: PowerupPlayerRow[];
};

// /maps, /versions
export type MapsResponse = { maps: string[] };
export type VersionsResponse = { versions: string[] };
