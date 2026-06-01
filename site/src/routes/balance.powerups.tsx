import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePowerupPickrate } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatPercent } from "../lib/format.js";
import type { PowerupPickrateRow } from "@pgc/shared";

type Preset = "7d" | "30d" | "90d";
type Search = { preset: Preset; since?: string; until?: string };

function PowerupPickratePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/balance/powerups" });
  const q = usePowerupPickrate({ since: search.since, until: search.until });

  const columns: Column<PowerupPickrateRow>[] = [
    { key: "powerup",       label: "Powerup",     sortable: true },
    { key: "times_offered", label: "Offered",     sortable: true, align: "right" },
    { key: "times_picked",  label: "Picked",      sortable: true, align: "right" },
    { key: "pick_rate",     label: "Pick rate",   sortable: true, align: "right",
      render: (r) => formatPercent(r.pick_rate) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Powerup pick-rate</h1>
      <div className="mb-4">
        <TimeRangePicker
          preset={search.preset}
          onChange={(preset, range) =>
            navigate({ search: (prev) => ({ ...prev, preset, since: range.since, until: range.until }) })
          }
        />
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <DataTable<PowerupPickrateRow>
            columns={columns}
            rows={q.data.data.rows}
            getRowKey={(r) => r.powerup}
            emptyMessage="No powerup data in selected range."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
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
  path: "/balance/powerups",
  component: PowerupPickratePage,
  validateSearch: (raw: Record<string, unknown>): Search => {
    const def = defaultRange();
    return {
      preset: (raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d"),
      since: typeof raw.since === "string" ? raw.since : def.since,
      until: typeof raw.until === "string" ? raw.until : def.until,
    };
  },
});
