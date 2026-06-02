import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiEnvelope, PickDetail, PickKeyStats, PickCoOfferRow, PickPlayerRow } from "@pgc/shared";
import { LoadingState } from "../LoadingState.js";
import { ErrorState } from "../ErrorState.js";
import { DataTable, type Column } from "../DataTable.js";
import { TimeRangePicker } from "../TimeRangePicker.js";
import { UpdatedAt } from "../UpdatedAt.js";
import { formatPercent } from "../../lib/format.js";
import type { Preset, DetailView } from "../../lib/balance.js";

// See PickratePage for why navigate is loosely typed here.
type Nav = (opts: Record<string, unknown>) => void;

/**
 * Generic detail page for one pick-analytics entity. `label` is the singular
 * noun ("Powerup"/"Class"/"Weapon"); `listPath`/`detailPath` are the TanStack
 * route patterns for this entity's list and detail pages.
 */
export function PickDetailPage({
  id,
  label,
  listPath,
  detailPath,
  preset,
  view,
  q,
  navigate,
}: {
  id: string;
  label: string;
  listPath: string;
  detailPath: string;
  preset: Preset;
  view: DetailView;
  q: UseQueryResult<ApiEnvelope<PickDetail>>;
  navigate: Nav;
}) {
  const coOfferColumns: Column<PickCoOfferRow>[] = [
    { key: "other_id", label: `Other ${label.toLowerCase()}`, sortable: true,
      render: (r) => <span className="text-accent">{r.other_id}</span> },
    { key: "co_offered", label: "Co-offered", sortable: true, align: "right" },
    { key: "target_rate", label: `${id} pick rate`, sortable: true, align: "right",
      sortValue: (r) => r.co_offered === 0 ? 0 : r.times_picked_target / r.co_offered,
      render: (r) => r.co_offered === 0 ? "—" : formatPercent(r.times_picked_target / r.co_offered) },
    { key: "other_rate", label: "Other pick rate", sortable: true, align: "right",
      sortValue: (r) => r.co_offered === 0 ? 0 : r.times_picked_other / r.co_offered,
      render: (r) => r.co_offered === 0 ? "—" : formatPercent(r.times_picked_other / r.co_offered) },
  ];

  const playerColumns: Column<PickPlayerRow>[] = [
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
        onClick={() => navigate({ to: listPath })}
        className="text-muted text-sm mb-3 hover:text-text"
      >
        ← {label}s
      </button>
      <h1 className="text-xl font-semibold mb-4">{label}: <span className="text-accent">{id}</span></h1>

      <div className="mb-4">
        <TimeRangePicker
          preset={preset}
          onChange={(p, range) =>
            navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, preset: p, since: range.since, until: range.until }) })
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
              active={view === "co-offers"}
              onClick={() => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, view: "co-offers" }) })}
            >
              Co-offered ({q.data.data.co_offers.length})
            </TabButton>
            <TabButton
              active={view === "players"}
              onClick={() => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, view: "players" }) })}
            >
              By player ({q.data.data.players.length})
            </TabButton>
          </div>

          {view === "co-offers" && (
            <DataTable<PickCoOfferRow>
              columns={coOfferColumns}
              rows={q.data.data.co_offers}
              getRowKey={(r) => r.other_id}
              onRowClick={(r) => navigate({ to: detailPath, params: { id: r.other_id }, search: (prev: unknown) => prev })}
              emptyMessage="No co-offer data in selected range."
            />
          )}
          {view === "players" && (
            <DataTable<PickPlayerRow>
              columns={playerColumns}
              rows={q.data.data.players}
              getRowKey={(r) => r.player_id}
              onRowClick={(r) => navigate({ to: "/players/$id", params: { id: r.player_id } })}
              emptyMessage={`No players have been offered this ${label.toLowerCase()} in the selected range.`}
            />
          )}

          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

function StatsCard({ stats }: { stats: PickKeyStats }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <StatField k="Rarity">{stats.rarity ?? "—"}</StatField>
      <StatField k="Pick rate">{stats.times_offered === 0 ? "—" : formatPercent(stats.pick_rate)}</StatField>
      <StatField k="Times offered">{stats.times_offered.toLocaleString()}</StatField>
      <StatField k="Times picked">{stats.times_picked.toLocaleString()}</StatField>
    </dl>
  );
}

function StatField({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="border border-border bg-surface rounded p-3">
      <div className="text-muted text-xs uppercase tracking-wide">{k}</div>
      <div className="text-text text-base">{children}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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
