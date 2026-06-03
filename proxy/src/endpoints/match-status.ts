// Shared HogQL fragments for deriving a match's lifecycle status from the
// `match_ended` event. Used by both /matches and /match so the list and the
// detail view classify a match identically.
//
// These are hardcoded SQL constants (no user input is interpolated), so the
// Worker's no-passthrough guarantee holds — see CLAUDE.md.
//
// They assume the calling query exposes these aliases:
//   m.rounds          — total_rounds for the match (coalesced to 0 elsewhere)
//   rp.rounds_played  — rounds actually played (from player_round_summary)
//   me.end_reason     — the match_ended `reason`, or '' when no match_ended
//
// Status rules (mirrors docs/telemetry.md in the game repo):
//   finished    — reason = 'completed', OR (back-compat) no match_ended but
//                 every round was played.
//   aborted     — any other non-empty reason (quit_to_menu/app_closed/abandoned).
//   in_progress — no match_ended and rounds aren't all played.

const COMPLETED = "coalesce(me.end_reason, '') = 'completed'";
const ABORTED = "coalesce(me.end_reason, '') NOT IN ('', 'completed')";
const HAS_END = "coalesce(me.end_reason, '') != ''";
// "rounds heuristic": total rounds known and all of them were played.
const ROUNDS_DONE = "coalesce(m.rounds, 0) > 0 AND coalesce(rp.rounds_played, 0) >= coalesce(m.rounds, 0)";

/** LEFT JOIN that exposes the per-match `match_ended` reason as `me.end_reason`. */
export const ENDED_JOIN = `
LEFT JOIN (
    SELECT properties.match_id AS match_id,
           argMax(properties.reason, timestamp) AS end_reason
    FROM events
    WHERE event = 'match_ended'
    GROUP BY match_id
) me ON m.match_id = me.match_id
`;

/** SQL expression evaluating to 'finished' | 'aborted' | 'in_progress'. */
export const STATUS_SQL = `multiIf(
    ${COMPLETED}, 'finished',
    ${ABORTED}, 'aborted',
    ${ROUNDS_DONE}, 'finished',
    'in_progress'
)`;

/**
 * WHERE predicate (sans leading AND) matching rows of the given status, kept
 * consistent with STATUS_SQL. Returns null for "all" (no filter).
 */
export function statusFilterSql(status: "finished" | "in_progress" | "aborted" | "all"): string | null {
  switch (status) {
    case "finished":
      return `((${COMPLETED}) OR (NOT (${HAS_END}) AND (${ROUNDS_DONE})))`;
    case "aborted":
      return `(${ABORTED})`;
    case "in_progress":
      return `(NOT (${HAS_END}) AND NOT (${ROUNDS_DONE}))`;
    case "all":
      return null;
  }
}
