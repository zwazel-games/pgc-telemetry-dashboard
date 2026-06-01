import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePlayer } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDateTime } from "../lib/format.js";
import type { PlayerMatchRow } from "@pgc/shared";

function PlayerHistoryPage() {
  const { id } = Route.useParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/players/$id" as any });

  const q = usePlayer(id);

  const columns: Column<PlayerMatchRow>[] = [
    { key: "played_at",   label: "Played",      sortable: true, render: (r) => formatDateTime(r.played_at) },
    { key: "match_id",    label: "Match",       render: (r) => <span className="text-accent">{r.match_id}</span> },
    { key: "rounds_seen", label: "Rounds seen", sortable: true, align: "right" },
  ];

  return (
    <div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <button onClick={() => navigate({ to: "/matches" as any })} className="text-muted text-sm mb-3 hover:text-text">← Matches</button>
      <h1 className="text-xl font-semibold mb-4">Player {id}</h1>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <DataTable<PlayerMatchRow>
            columns={columns}
            rows={q.data.data.matches}
            getRowKey={(r) => r.match_id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onRowClick={(r) => navigate({ to: "/matches/$id" as any, params: { id: r.match_id } as any })}
            emptyMessage="This player has no recorded matches."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$id",
  component: PlayerHistoryPage,
});
