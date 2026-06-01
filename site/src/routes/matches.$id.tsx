import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useMatch } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { EmptyState } from "../components/EmptyState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDuration } from "../lib/format.js";
import type { ScoreboardRow } from "@pgc/shared";

function MatchDetailPage() {
  const { id } = Route.useParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/matches/$id" as any });
  const q = useMatch(id);

  const columns: Column<ScoreboardRow>[] = [
    { key: "player_id", label: "Player",
      render: (r) => <span className="text-accent">{r.player_id}</span> },
    { key: "kills",     label: "Kills",  sortable: true, align: "right" },
    { key: "deaths",    label: "Deaths", sortable: true, align: "right" },
    { key: "points",    label: "Points", sortable: true, align: "right" },
  ];

  return (
    <div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <button onClick={() => navigate({ to: "/matches" as any })} className="text-muted text-sm mb-3 hover:text-text">← Matches</button>
      <h1 className="text-xl font-semibold mb-2">Match {id}</h1>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          {q.data.data.overview ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-sm">
              <Field k="Map">{q.data.data.overview.map}</Field>
              <Field k="Version">{q.data.data.overview.version}</Field>
              <Field k="Players">{q.data.data.overview.players}/{q.data.data.overview.max_players}</Field>
              <Field k="Rounds">{q.data.data.overview.rounds}</Field>
              <Field k="Round length">{formatDuration(q.data.data.overview.round_s)}</Field>
            </dl>
          ) : (
            <EmptyState message="No overview for this match." />
          )}

          <h2 className="text-lg font-medium mb-2">Scoreboard</h2>
          <DataTable<ScoreboardRow>
            columns={columns}
            rows={q.data.data.scoreboard}
            getRowKey={(r) => r.player_id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onRowClick={(r) => navigate({ to: "/players/$id" as any, params: { id: r.player_id } as any })}
            emptyMessage="No player rounds recorded."
          />
          <UpdatedAt iso={q.data.generated_at} />
        </>
      )}
    </div>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface rounded p-3">
      <div className="text-muted text-xs uppercase tracking-wide">{k}</div>
      <div className="text-text">{children}</div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$id",
  component: MatchDetailPage,
});
