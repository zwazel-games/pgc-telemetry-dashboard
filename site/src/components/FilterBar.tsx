import { TimeRangePicker } from "./TimeRangePicker.js";

type Preset = "7d" | "30d" | "90d";

export function FilterBar({
  preset,
  onPresetChange,
  map,
  maps,
  onMapChange,
  version,
  versions,
  onVersionChange,
}: {
  preset: Preset;
  onPresetChange: (preset: Preset, range: { since: string; until: string }) => void;
  map?: string;
  maps: string[] | null;
  onMapChange: (map: string | undefined) => void;
  version?: string;
  versions: string[] | null;
  onVersionChange: (version: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <TimeRangePicker preset={preset} onChange={onPresetChange} />
      {maps !== null && (
        <select
          value={map ?? ""}
          onChange={(e) => onMapChange(e.target.value || undefined)}
          className="bg-surface border border-border text-text rounded px-2 py-1 text-sm"
        >
          <option value="">All maps</option>
          {maps.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {versions !== null && (
        <select
          value={version ?? ""}
          onChange={(e) => onVersionChange(e.target.value || undefined)}
          className="bg-surface border border-border text-text rounded px-2 py-1 text-sm"
        >
          <option value="">All versions</option>
          {versions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
    </div>
  );
}
