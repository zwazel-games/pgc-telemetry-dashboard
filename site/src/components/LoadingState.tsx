export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="text-muted py-8">{label}</div>;
}
