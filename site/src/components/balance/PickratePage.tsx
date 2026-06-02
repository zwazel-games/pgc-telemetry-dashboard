import type { UseQueryResult } from "@tanstack/react-query";
import type { ApiEnvelope, Pickrate, PickrateRow } from "@pgc/shared";
import { LoadingState } from "../LoadingState.js";
import { ErrorState } from "../ErrorState.js";
import { DataTable, type Column } from "../DataTable.js";
import { TimeRangePicker } from "../TimeRangePicker.js";
import { UpdatedAt } from "../UpdatedAt.js";
import { formatPercent } from "../../lib/format.js";
import type { Preset } from "../../lib/balance.js";

// The route file owns the typed TanStack `navigate` (which needs `as any`
// casts on `to`/`params`/`search`); it hands a loosely-typed function down so
// all the navigation lives here in one shared place.
type Nav = (opts: Record<string, unknown>) => void;

/**
 * Generic pick-rate list for one pick-analytics entity (powerup/class/weapon).
 * `label` is the entity column header; `detailPath` is the TanStack route
 * pattern for the per-entity detail page (e.g. "/balance/powerups/$id").
 */
export function PickratePage({
  title,
  label,
  detailPath,
  preset,
  q,
  navigate,
}: {
  title: string;
  label: string;
  detailPath: string;
  preset: Preset;
  q: UseQueryResult<ApiEnvelope<Pickrate>>;
  navigate: Nav;
}) {
  const columns: Column<PickrateRow>[] = [
    { key: "id", label, sortable: true,
      render: (r) => <span className="text-accent">{r.id}</span> },
    { key: "times_offered", label: "Offered", sortable: true, align: "right" },
    { key: "times_picked", label: "Picked", sortable: true, align: "right" },
    { key: "pick_rate", label: "Pick rate", sortable: true, align: "right",
      render: (r) => formatPercent(r.pick_rate) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{title}</h1>
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
          <DataTable<PickrateRow>
            columns={columns}
            rows={q.data.data.rows}
            getRowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: detailPath, params: { id: r.id }, search: (prev: unknown) => prev })}
            emptyMessage={`No ${label.toLowerCase()} data in selected range.`}
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}
