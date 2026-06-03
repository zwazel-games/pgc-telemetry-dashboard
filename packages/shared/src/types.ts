// Wire envelope
export type ApiEnvelope<T> = { data: T; generated_at: string };
export type ApiError = { error: string; field?: string };

// Filters
export type TimeRange = { since?: string; until?: string };

// /matches
export type Platform = "steam" | "non-steam";
/**
 * Lifecycle of a match, derived from the `match_ended` event's `reason`:
 * - `finished`    — the match reached its final round (`reason = completed`),
 *                   or (back-compat for pre-tracking matches with no
 *                   `match_ended`) every round was played.
 * - `aborted`     — ended early (`reason in quit_to_menu/app_closed/abandoned`).
 * - `in_progress` — no `match_ended` recorded and rounds aren't all played.
 */
export type MatchStatus = "finished" | "in_progress" | "aborted";
/** Server-side status filter. "all" drops the filter. Default "finished". */
export type MatchStatusFilter = MatchStatus | "all";
export type MatchesRequest = TimeRange & {
  map?: string;
  version?: string;
  platform?: Platform;
  status?: MatchStatusFilter;
};
export type Match = {
  match_id: string;
  started_at: string;
  map: string;
  rounds: number;
  rounds_played: number;
  players: number;
  max_players: number;
  round_duration_s: number;
  version: string;
  is_steam: boolean;
  status: MatchStatus;
};
export type MatchesResponse = { matches: Match[] };

// /match?id=
export type MatchOverview = {
  map: string;
  rounds: number;
  rounds_played: number;
  players: number;
  max_players: number;
  round_s: number;
  version: string;
  is_steam: boolean;
  status: MatchStatus;
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

// Pick-analytics family — shared by the structurally-identical `*_picked`
// events (powerup / class / weapon). The entity is identified by a neutral
// `id`; the human label ("Powerup"/"Class"/"Weapon") is a frontend concern.

// /<entity>-pickrate  (e.g. /powerup-pickrate, /class-pickrate)
export type PickrateRow = {
  id: string;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type Pickrate = { rows: PickrateRow[] };

// /<entity>?id=  (e.g. /powerup?id=, /weapon?id=)
export type PickKeyStats = {
  id: string;
  rarity: string | null;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PickCoOfferRow = {
  other_id: string;
  co_offered: number;
  times_picked_target: number;
  times_picked_other: number;
};
export type PickPlayerRow = {
  player_id: string;
  times_offered: number;
  times_picked: number;
  pick_rate: number;
};
export type PickDetail = {
  stats: PickKeyStats;
  co_offers: PickCoOfferRow[];
  players: PickPlayerRow[];
};

// /maps, /versions
export type MapsResponse = { maps: string[] };
export type VersionsResponse = { versions: string[] };
