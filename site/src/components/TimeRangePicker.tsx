type Preset = "7d" | "30d" | "90d" | "custom";

function presetToRange(preset: Exclude<Preset, "custom">): { since: string; until: string } {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const now = Date.now();
  return {
    since: new Date(now - days * 86_400_000).toISOString(),
    until: new Date(now).toISOString(),
  };
}

export function TimeRangePicker({
  preset,
  onChange,
}: {
  preset: Preset;
  onChange: (preset: Exclude<Preset, "custom">, range: { since: string; until: string }) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["7d", "30d", "90d"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p, presetToRange(p))}
          className={`px-3 py-1 text-sm rounded border ${
            preset === p ? "border-accent text-accent" : "border-border text-muted hover:text-text"
          }`}
        >
          Last {p}
        </button>
      ))}
    </div>
  );
}
