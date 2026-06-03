import type { MatchStatus } from "@pgc/shared";

// Full literal class strings per status so Tailwind's content scanner keeps
// them (no dynamic class construction).
const STYLES: Record<MatchStatus, { label: string; className: string }> = {
  finished:    { label: "Finished",    className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  in_progress: { label: "In progress", className: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  aborted:     { label: "Aborted",     className: "text-rose-400 border-rose-400/30 bg-rose-400/10" },
};

const FALLBACK = { label: "Unknown", className: "text-muted border-border bg-surface" };

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const s = STYLES[status] ?? FALLBACK;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
