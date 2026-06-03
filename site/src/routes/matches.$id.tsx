import { useMemo } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useMatch, useMatchRounds } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { EmptyState } from "../components/EmptyState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { MatchStatusBadge } from "../components/MatchStatusBadge.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDuration, formatPercent } from "../lib/format.js";
import type {
  MatchRounds,
  PlayerFinalInventory,
  RoundPlayerSummary,
  RoundPowerupPick,
  ScoreboardRow,
  TierWeight,
} from "@pgc/shared";

type View = "scoreboard" | "rounds";
type Search = { view: View };

function MatchDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/matches/$id" as any });
  const q = useMatch(id);
  const roundsQ = useMatchRounds(id, search.view === "rounds");

  // Map player_id → final powerups, used by the scoreboard expand panel.
  const inventoryByPlayer = useMemo(() => {
    const map = new Map<string, string[]>();
    if (q.data) for (const inv of q.data.data.inventories) map.set(inv.player_id, inv.powerups);
    return map;
  }, [q.data]);

  return (
    <div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <button onClick={() => navigate({ to: "/matches" as any, search: {} as any })} className="text-muted text-sm mb-3 hover:text-text">← Matches</button>
      <h1 className="text-xl font-semibold mb-2">Match {id}</h1>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          {q.data.data.overview ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-sm">
              <Field k="Status"><MatchStatusBadge status={q.data.data.overview.status} /></Field>
              <Field k="Map">{q.data.data.overview.map}</Field>
              <Field k="Version">{q.data.data.overview.version}</Field>
              <Field k="Platform">{q.data.data.overview.is_steam ? "Steam" : "Non-Steam"}</Field>
              <Field k="Players">{q.data.data.overview.players}/{q.data.data.overview.max_players}</Field>
              <Field k="Rounds">{q.data.data.overview.rounds_played}/{q.data.data.overview.rounds}</Field>
              <Field k="Round length">{formatDuration(q.data.data.overview.round_s)}</Field>
            </dl>
          ) : (
            <EmptyState message="No overview for this match." />
          )}

          <div className="flex gap-1 mb-4 mt-2 border-b border-border">
            <TabButton
              active={search.view === "scoreboard"}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => navigate({ search: ((prev: Search) => ({ ...prev, view: "scoreboard" })) as any })}
            >
              Final scoreboard
            </TabButton>
            <TabButton
              active={search.view === "rounds"}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => navigate({ search: ((prev: Search) => ({ ...prev, view: "rounds" })) as any })}
            >
              Rounds
            </TabButton>
          </div>

          {search.view === "scoreboard" && (
            <ScoreboardView
              scoreboard={q.data.data.scoreboard}
              inventoryByPlayer={inventoryByPlayer}
              onViewPlayer={(playerId) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                navigate({ to: "/players/$id" as any, params: { id: playerId } as any })
              }
              onViewPowerup={(powerupId) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                navigate({ to: "/balance/powerups/$id" as any, params: { id: powerupId } as any, search: ((p: unknown) => p) as any })
              }
            />
          )}
          {search.view === "rounds" && (
            <RoundsView
              q={roundsQ}
              onViewPlayer={(playerId) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                navigate({ to: "/players/$id" as any, params: { id: playerId } as any })
              }
              onViewPowerup={(powerupId) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                navigate({ to: "/balance/powerups/$id" as any, params: { id: powerupId } as any, search: ((p: unknown) => p) as any })
              }
            />
          )}

          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

// --- Scoreboard tab -----------------------------------------------------

function ScoreboardView({
  scoreboard,
  inventoryByPlayer,
  onViewPlayer,
  onViewPowerup,
}: {
  scoreboard: ScoreboardRow[];
  inventoryByPlayer: Map<string, string[]>;
  onViewPlayer: (playerId: string) => void;
  onViewPowerup: (powerupId: string) => void;
}) {
  const columns: Column<ScoreboardRow>[] = [
    { key: "player_id", label: "Player",
      render: (r) => <span className="text-accent">{r.player_id}</span> },
    { key: "kills",     label: "Kills",  sortable: true, align: "right" },
    { key: "deaths",    label: "Deaths", sortable: true, align: "right" },
    { key: "points",    label: "Points", sortable: true, align: "right" },
  ];

  return (
    <DataTable<ScoreboardRow>
      columns={columns}
      rows={scoreboard}
      getRowKey={(r) => r.player_id}
      renderExpanded={(r) => (
        <InventoryPanel
          inventory={inventoryByPlayer.get(r.player_id)}
          onViewPlayer={() => onViewPlayer(r.player_id)}
          onViewPowerup={onViewPowerup}
        />
      )}
      emptyMessage="No player rounds recorded."
    />
  );
}

/** Groups duplicate picks while preserving the first-occurrence order. */
function groupCounts(items: string[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => ({ id, count }));
}

function InventoryPanel({
  inventory,
  onViewPlayer,
  onViewPowerup,
}: {
  inventory: string[] | undefined;
  onViewPlayer: () => void;
  onViewPowerup: (powerupId: string) => void;
}) {
  const grouped = inventory ? groupCounts(inventory) : [];
  const totalPicks = inventory?.length ?? 0;
  return (
    <div className="space-y-3">
      <div>
        <div className="text-muted text-xs uppercase tracking-wide mb-1">
          Final inventory{totalPicks > 0 ? ` (${totalPicks})` : ""}
        </div>
        {grouped.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {grouped.map((g) => (
              <button
                key={g.id}
                onClick={() => onViewPowerup(g.id)}
                className="bg-bg border border-border rounded px-2 py-1 text-xs hover:border-accent hover:text-accent transition-colors"
              >
                {g.id}{g.count > 1 && <span className="text-muted ml-1">×{g.count}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-muted text-sm">No powerups picked.</div>
        )}
      </div>
      <button onClick={onViewPlayer} className="text-accent text-sm hover:underline">
        View player profile →
      </button>
    </div>
  );
}

// --- Rounds tab ---------------------------------------------------------

function RoundsView({
  q,
  onViewPlayer,
  onViewPowerup,
}: {
  q: ReturnType<typeof useMatchRounds>;
  onViewPlayer: (playerId: string) => void;
  onViewPowerup: (powerupId: string) => void;
}) {
  // Group summaries and picks by round number.
  const grouped = useMemo(() => {
    if (!q.data) return null;
    return groupByRound(q.data.data);
  }, [q.data]);

  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!grouped || grouped.length === 0) return <EmptyState message="No round data recorded for this match." />;

  return (
    <div className="space-y-6">
      {grouped.map((round) => (
        <RoundCard
          key={round.round}
          round={round.round}
          summaries={round.summaries}
          pickByPlayer={round.pickByPlayer}
          onViewPlayer={onViewPlayer}
          onViewPowerup={onViewPowerup}
        />
      ))}
    </div>
  );
}

type RoundGroup = {
  round: number;
  summaries: RoundPlayerSummary[];
  pickByPlayer: Map<string, RoundPowerupPick>;
};

function groupByRound(d: MatchRounds): RoundGroup[] {
  const rounds = new Map<number, RoundGroup>();
  for (const s of d.summaries) {
    if (!rounds.has(s.round)) rounds.set(s.round, { round: s.round, summaries: [], pickByPlayer: new Map() });
    rounds.get(s.round)!.summaries.push(s);
  }
  for (const p of d.picks) {
    if (!rounds.has(p.round)) rounds.set(p.round, { round: p.round, summaries: [], pickByPlayer: new Map() });
    rounds.get(p.round)!.pickByPlayer.set(p.player_id, p);
  }
  return [...rounds.values()].sort((a, b) => a.round - b.round);
}

function RoundCard({
  round,
  summaries,
  pickByPlayer,
  onViewPlayer,
  onViewPowerup,
}: {
  round: number;
  summaries: RoundPlayerSummary[];
  pickByPlayer: Map<string, RoundPowerupPick>;
  onViewPlayer: (playerId: string) => void;
  onViewPowerup: (powerupId: string) => void;
}) {
  const columns: Column<RoundPlayerSummary>[] = [
    { key: "player_id", label: "Player",
      render: (r) => <span className="text-accent">{r.player_id}</span> },
    { key: "class",  label: "Class",  sortable: true },
    { key: "weapon", label: "Weapon", sortable: true },
    { key: "kills",  label: "Kills",  sortable: true, align: "right" },
    { key: "deaths", label: "Deaths", sortable: true, align: "right" },
    { key: "points", label: "Points", sortable: true, align: "right" },
  ];

  // Round value in events is 0-indexed; display as 1-indexed for humans.
  const displayRound = round + 1;
  const hasPicks = pickByPlayer.size > 0;

  return (
    <section className="border border-border bg-surface/40 rounded-lg p-4">
      <h3 className="text-base font-medium mb-3">
        Round {displayRound}
        {!hasPicks && <span className="text-muted text-xs ml-2">(no powerup picks)</span>}
      </h3>
      {summaries.length === 0 ? (
        <EmptyState message="No player summaries for this round." />
      ) : (
        <DataTable<RoundPlayerSummary>
          columns={columns}
          rows={summaries}
          getRowKey={(r) => r.player_id}
          renderExpanded={(r) => (
            <PickPanel
              pick={pickByPlayer.get(r.player_id)}
              onViewPlayer={() => onViewPlayer(r.player_id)}
              onViewPowerup={onViewPowerup}
            />
          )}
        />
      )}
    </section>
  );
}

function PickPanel({
  pick,
  onViewPlayer,
  onViewPowerup,
}: {
  pick: RoundPowerupPick | undefined;
  onViewPlayer: () => void;
  onViewPowerup: (powerupId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-muted text-xs uppercase tracking-wide mb-2">Offered</div>
        {pick && pick.offered.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {pick.offered.map((o, i) => {
              const isPicked = pick.picked === o.id;
              return (
                <li key={`${o.id}-${i}`} className="flex items-center gap-2">
                  <button
                    onClick={() => onViewPowerup(o.id)}
                    className={`min-w-[10rem] text-left hover:underline ${isPicked ? "text-accent font-medium" : "text-text hover:text-accent"}`}
                  >
                    {o.id}
                  </button>
                  <span className="text-muted text-xs">{o.rarity}</span>
                  {isPicked && <span className="ml-auto text-xs uppercase tracking-wide text-accent">picked</span>}
                </li>
              );
            })}
            {pick.picked === "" && (
              <li className="text-muted text-xs italic">No selection made.</li>
            )}
          </ul>
        ) : (
          <div className="text-muted text-sm">No powerup offer at this round.</div>
        )}
      </div>

      <div>
        <div className="text-muted text-xs uppercase tracking-wide mb-2">Roll chances</div>
        {pick && pick.tier_weights.length > 0 ? (
          <TierWeightsTable weights={pick.tier_weights} />
        ) : (
          <div className="text-muted text-sm">—</div>
        )}
      </div>

      <div className="md:col-span-2">
        <button onClick={onViewPlayer} className="text-accent text-sm hover:underline">
          View player profile →
        </button>
      </div>
    </div>
  );
}

const TIER_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

function TierWeightsTable({ weights }: { weights: TierWeight[] }) {
  const total = weights.reduce((sum, w) => sum + w.final_weight, 0);
  const sorted = [...weights].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(a.tier);
    const bi = TIER_ORDER.indexOf(b.tier);
    if (ai === -1 && bi === -1) return a.tier.localeCompare(b.tier);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return (
    <table className="text-sm">
      <tbody>
        {sorted.map((w) => {
          const pct = total > 0 ? w.final_weight / total : 0;
          return (
            <tr key={w.tier}>
              <td className="pr-3 capitalize">{w.tier}</td>
              <td className="pr-3 text-right tabular-nums">{formatPercent(pct)}</td>
              <td className="text-muted text-xs tabular-nums">
                w {w.final_weight}{w.base_weight !== w.final_weight ? ` (base ${w.base_weight})` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- Shared bits --------------------------------------------------------

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface rounded p-3">
      <div className="text-muted text-xs uppercase tracking-wide">{k}</div>
      <div className="text-text">{children}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm -mb-px border-b-2 ${
        active ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$id",
  component: MatchDetailPage,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    view: raw.view === "rounds" ? "rounds" : "scoreboard",
  }),
});
