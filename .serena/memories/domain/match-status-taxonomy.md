# Match lifecycle status (finished / in-progress / aborted)

The authoritative taxonomy for a match's lifecycle lives in the **game repo**,
not this one: `D:\Gitkraken\project-getting-control\docs\telemetry.md`
(§ `match_ended`). That repo is added as an extra working dir purely as
reference for the PostHog event schema — all dashboard code stays here.

Source signal: the `match_ended` event carries a `reason` field:
- `completed`    -> **finished** (reached final round)
- `quit_to_menu` / `app_closed` / `abandoned` -> **aborted**
  (`abandoned` is a next-launch recovery of a crashed/killed session;
   pairs with a `crash` event sharing the `match_id`)
- no `match_ended` at all -> **in_progress** (ongoing, or host never relaunched)

## How the dashboard derives it
Shared HogQL fragments in `proxy/src/endpoints/match-status.ts` (STATUS_SQL +
statusFilterSql) classify a match, reused by both `/matches` and `/match` so
list and detail agree. Decisions baked in:
- **Back-compat fallback:** matches predating `match_ended` tracking have no
  end event, so they'd all read as in-progress forever. When there is no
  `match_ended`, fall back to the old rounds heuristic
  (`rounds_played >= total_rounds && total_rounds > 0` -> finished).
- **Stale cleanup (query-side only, data untouched):** a match with no
  `match_ended` and rounds not all played is reclassified in-progress ->
  **aborted** once it's been silent for `STALE_HOURS` (= 2). "Last activity" =
  `greatest(match_started.timestamp, max(player_round_summary.timestamp))`.
  Requires the calling query to expose `m.started_at` and `rp.last_round_at`
  (added to the round subqueries in both endpoints). This is folded into both
  STATUS_SQL and statusFilterSql so the status filter stays consistent.
- `/matches` `status` query param is 4-way: `finished` (default) /
  `in_progress` / `aborted` / `all`. It replaced the old `finished`
  (true/false/all) param. Default stays "finished" so the public list isn't
  polluted by the maintainer's own local aborted/in-progress test sessions.
- Any non-empty reason that isn't `completed` counts as aborted (robust to
  unexpected reason values).

Frontend: `site/src/components/MatchStatusBadge.tsx` renders the badge in both
the list (Status column) and the match-detail overview.

## Matches list version filter
The version filter on `/matches` defaults to the **latest version** (not all).
`/versions` returns versions newest-first (`ORDER BY game_version DESC` in
`distincts.ts`), so the route picks `versions[0]` via a once-per-mount effect
in `site/src/routes/matches.tsx`, unless the URL already pins `?version=`.

Related: `mem:query-patterns/hogql-array-contains`.
