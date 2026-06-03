import type { MatchStatusFilter, Platform } from "@pgc/shared";
import { TimeRangePicker } from "./TimeRangePicker.js";

type Preset = "7d" | "30d" | "90d";

const SELECT_CLASS = "bg-surface border border-border text-text rounded px-2 py-1 text-sm";

export function FilterBar({
  preset,
  onPresetChange,
  map,
  maps,
  onMapChange,
  version,
  versions,
  onVersionChange,
  platform,
  onPlatformChange,
  status,
  onStatusChange,
}: {
  preset: Preset;
  onPresetChange: (preset: Preset, range: { since: string; until: string }) => void;
  map?: string;
  maps: string[] | null;
  onMapChange: (map: string | undefined) => void;
  version?: string;
  versions: string[] | null;
  onVersionChange: (version: string | undefined) => void;
  platform?: Platform;
  onPlatformChange: (platform: Platform | undefined) => void;
  status: MatchStatusFilter;
  onStatusChange: (status: MatchStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <TimeRangePicker preset={preset} onChange={onPresetChange} />
      {maps !== null && (
        <select value={map ?? ""} onChange={(e) => onMapChange(e.target.value || undefined)} className={SELECT_CLASS}>
          <option value="">All maps</option>
          {maps.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {versions !== null && (
        <select value={version ?? ""} onChange={(e) => onVersionChange(e.target.value || undefined)} className={SELECT_CLASS}>
          <option value="">All versions</option>
          {versions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
      <select
        value={platform ?? ""}
        onChange={(e) => onPlatformChange((e.target.value || undefined) as Platform | undefined)}
        className={SELECT_CLASS}
      >
        <option value="">All platforms</option>
        <option value="steam">Steam</option>
        <option value="non-steam">Non-Steam</option>
      </select>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as MatchStatusFilter)}
        className={SELECT_CLASS}
      >
        <option value="finished">Finished</option>
        <option value="in_progress">In progress</option>
        <option value="aborted">Aborted</option>
        <option value="all">All matches</option>
      </select>
    </div>
  );
}
