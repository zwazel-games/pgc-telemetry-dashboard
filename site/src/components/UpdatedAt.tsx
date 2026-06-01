import { formatRelative } from "../lib/format.js";

export function UpdatedAt({ iso }: { iso: string }) {
  return <div className="text-muted text-xs mt-4">Updated {formatRelative(iso)}</div>;
}
