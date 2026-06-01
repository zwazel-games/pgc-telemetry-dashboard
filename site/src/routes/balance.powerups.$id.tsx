import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePowerupDetail } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatPercent } from "../lib/format.js";
import type { PowerupCoOfferRow, PowerupKeyStats, PowerupPlayerRow } from "@pgc/shared";

type View = "co-offers" | "players";
type Preset = "7d" | "30d" | "90d";
type Search = {
  preset: Preset;
  since?: string;
  until?: string;
  view: View;
};

function PowerupDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/balance/powerups/$id" as any });
  const q = usePowerupDetail(id, { since: search.since, until: search.until });

  const coOfferColumns: Column<PowerupCoOfferRow>[] = [
    { key: "other_powerup", label: "Other powerup", sortable: true,
      render: (r) => <span className="text-accent">{r.other_powerup}</span> },
    { key: "co_offered", label: "Co-offered", sortable: true, align: "right" },
    { key: "target_rate", label: `${id} pick rate`, sortable: true, align: "right",
      sortValue: (r) => r.co_offered === 0 ? 0 : r.times_picked_target / r.co_offered,
      render: (r) => r.co_offered === 0 ? "—" : formatPercent(r.times_picked_target / r.co_offered) },
    { key: "other_rate", label: "Other pick rate", sortable: true, align: "right",
      sortValue: (r) => r.co_offered === 0 ? 0 : r.times_picked_other / r.co_offered,
      render: (r) => r.co_offered === 0 ? "—" : formatPercent(r.times_picked_other / r.co_offered) },
  ];

  const playerColumns: Column<PowerupPlayerRow>[] = [
    { key: "player_id", label: "Player", sortable: true,
      render: (r) => <span className="text-accent">{r.player_id}</span> },
    { key: "times_offered", label: "Offered", sortable: true, align: "right" },
    { key: "times_picked", label: "Picked", sortable: true, align: "right" },
    { key: "pick_rate", label: "Pick rate", sortable: true, align: "right",
      render: (r) => formatPercent(r.pick_rate) },
  ];

  return (
    <div>
      <button
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={() => navigate({ to: "/balance/powerups" as any })}
        className="text-muted text-sm mb-3 hover:text-text"
      >
        ← Powerups
      </button>
      <h1 className="text-xl font-semibold mb-4">Powerup: <span className="text-accent">{id}</span></h1>

      <div className="mb-4">
        <TimeRangePicker
          preset={search.preset}
          onChange={(preset, range) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            navigate({ search: ((prev: Search) => ({ ...prev, preset, since: range.since, until: range.until })) as any })
          }
        />
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <StatsCard stats={q.data.data.stats} />

          <div className="flex gap-1 mb-4 mt-6 border-b border-border">
            <TabButton
              active={search.view === "co-offers"}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => navigate({ search: ((prev: Search) => ({ ...prev, view: "co-offers" })) as any })}
            >
              Co-offered ({q.data.data.co_offers.length})
            </TabButton>
            <TabButton
              active={search.view === "players"}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => navigate({ search: ((prev: Search) => ({ ...prev, view: "players" })) as any })}
            >
              By player ({q.data.data.players.length})
            </TabButton>
          </div>

          {search.view === "co-offers" && (
            <DataTable<PowerupCoOfferRow>
              columns={coOfferColumns}
              rows={q.data.data.co_offers}
              getRowKey={(r) => r.other_powerup}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onRowClick={(r) => navigate({ to: "/balance/powerups/$id" as any, params: { id: r.other_powerup } as any, search: ((prev: unknown) => prev) as any })}
              emptyMessage="No co-offer data in selected range."
            />
          )}
          {search.view === "players" && (
            <DataTable<PowerupPlayerRow>
              columns={playerColumns}
              rows={q.data.data.players}
              getRowKey={(r) => r.player_id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onRowClick={(r) => navigate({ to: "/players/$id" as any, params: { id: r.player_id } as any })}
              emptyMessage="No players have been offered this powerup in the selected range."
            />
          )}

          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

function StatsCard({ stats }: { stats: PowerupKeyStats }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <StatField k="Rarity">{stats.rarity ?? "—"}</StatField>
      <StatField k="Pick rate">{stats.times_offered === 0 ? "—" : formatPercent(stats.pick_rate)}</StatField>
      <StatField k="Times offered">{stats.times_offered.toLocaleString()}</StatField>
      <StatField k="Times picked">{stats.times_picked.toLocaleString()}</StatField>
    </dl>
  );
}

function StatField({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface rounded p-3">
      <div className="text-muted text-xs uppercase tracking-wide">{k}</div>
      <div className="text-text text-base">{children}</div>
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

const DEFAULT_DAYS = 30;
function defaultRange() {
  const now = Date.now();
  return {
    since: new Date(now - DEFAULT_DAYS * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/balance/powerups/$id",
  component: PowerupDetailPage,
  validateSearch: (raw: Record<string, unknown>): Search => {
    const def = defaultRange();
    return {
      preset: (raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d"),
      since: typeof raw.since === "string" ? raw.since : def.since,
      until: typeof raw.until === "string" ? raw.until : def.until,
      view: raw.view === "players" ? "players" : "co-offers",
    };
  },
});
