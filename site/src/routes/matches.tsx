import { useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useMatches, useMaps, useVersions } from "../api/queries.js";
import { LoadingState } from "../components/LoadingState.js";
import { ErrorState } from "../components/ErrorState.js";
import { DataTable, type Column } from "../components/DataTable.js";
import { FilterBar } from "../components/FilterBar.js";
import { MatchStatusBadge } from "../components/MatchStatusBadge.js";
import { UpdatedAt } from "../components/UpdatedAt.js";
import { formatDateTime, formatDuration } from "../lib/format.js";
import type { MatchStatusFilter, Match, Platform } from "@pgc/shared";

type Search = {
  preset: "7d" | "30d" | "90d";
  since?: string;
  until?: string;
  map?: string;
  version?: string;
  platform?: Platform;
  status: MatchStatusFilter;
};

function MatchesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/matches" });
  const mapsQ = useMaps();
  const versionsQ = useVersions();

  // Local UI state for filters — updates immediately on user interaction.
  // The URL also gets updated (async) so that query keys change and data refetches.
  const [localMap, setLocalMap] = useState<string | undefined>(search.map);
  const [localVersion, setLocalVersion] = useState<string | undefined>(search.version);
  const [localPlatform, setLocalPlatform] = useState<Platform | undefined>(search.platform);
  const [localStatus, setLocalStatus] = useState<MatchStatusFilter>(search.status);
  const [localPreset, setLocalPreset] = useState<Search["preset"]>(search.preset);
  const [localSince, setLocalSince] = useState<string | undefined>(search.since);
  const [localUntil, setLocalUntil] = useState<string | undefined>(search.until);

  const matchesQ = useMatches({ since: localSince, until: localUntil, map: localMap, version: localVersion, platform: localPlatform, status: localStatus });

  const columns: Column<Match>[] = [
    { key: "match_id",   label: "Match ID", sortable: true,
      render: (r) => <span className="text-accent">{r.match_id}</span> },
    { key: "status",     label: "Status",  sortable: true,
      render: (r) => <MatchStatusBadge status={r.status} /> },
    { key: "started_at", label: "Started", sortable: true, render: (r) => formatDateTime(r.started_at) },
    { key: "map",        label: "Map",     sortable: true },
    { key: "version",    label: "Version", sortable: true },
    { key: "is_steam",   label: "Platform", sortable: true,
      render: (r) => r.is_steam ? "Steam" : "Non-Steam",
      sortValue: (r) => r.is_steam ? "Steam" : "Non-Steam" },
    { key: "rounds_played", label: "Rounds", sortable: true, align: "right",
      sortValue: (r) => r.rounds_played,
      render: (r) => `${r.rounds_played}/${r.rounds}` },
    { key: "players",    label: "Players", sortable: true, align: "right",
      render: (r) => `${r.players}/${r.max_players}` },
    { key: "round_duration_s", label: "Round len", sortable: true, align: "right",
      render: (r) => formatDuration(r.round_duration_s) },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Matches</h1>
      <FilterBar
        preset={localPreset}
        onPresetChange={(preset, range) => {
          setLocalPreset(preset);
          setLocalSince(range.since);
          setLocalUntil(range.until);
          navigate({ search: (prev) => ({ ...prev, preset, since: range.since, until: range.until }) });
        }}
        map={localMap}
        maps={mapsQ.data?.data.maps ?? null}
        onMapChange={(map) => {
          setLocalMap(map);
          navigate({ search: (prev) => ({ ...prev, map }) });
        }}
        version={localVersion}
        versions={versionsQ.data?.data.versions ?? null}
        onVersionChange={(version) => {
          setLocalVersion(version);
          navigate({ search: (prev) => ({ ...prev, version }) });
        }}
        platform={localPlatform}
        onPlatformChange={(platform) => {
          setLocalPlatform(platform);
          navigate({ search: (prev) => ({ ...prev, platform }) });
        }}
        status={localStatus}
        onStatusChange={(status) => {
          setLocalStatus(status);
          navigate({ search: (prev) => ({ ...prev, status }) });
        }}
      />

      {matchesQ.isPending && <LoadingState />}
      {matchesQ.isError && (
        <ErrorState message={(matchesQ.error as Error).message} onRetry={() => matchesQ.refetch()} />
      )}
      {matchesQ.data && (
        <>
          <DataTable<Match>
            columns={columns}
            rows={matchesQ.data.data.matches}
            getRowKey={(r) => r.match_id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onRowClick={(r) => navigate({ to: "/matches/$id" as any, params: { id: r.match_id }, search: {} as any })}
            emptyMessage="No matches in selected range."
          />
          <UpdatedAt iso={matchesQ.data.generated_at} />
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
  path: "/matches",
  component: MatchesPage,
  validateSearch: (raw: Record<string, unknown>): Search => {
    const def = defaultRange();
    return {
      preset: (raw.preset === "7d" || raw.preset === "90d" ? raw.preset : "30d"),
      since: typeof raw.since === "string" ? raw.since : def.since,
      until: typeof raw.until === "string" ? raw.until : def.until,
      map: typeof raw.map === "string" && raw.map.length > 0 ? raw.map : undefined,
      version: typeof raw.version === "string" && raw.version.length > 0 ? raw.version : undefined,
      platform: raw.platform === "steam" || raw.platform === "non-steam" ? raw.platform : undefined,
      status:
        raw.status === "in_progress" || raw.status === "aborted" || raw.status === "all"
          ? raw.status
          : "finished",
    };
  },
});
