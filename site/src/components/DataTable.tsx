import { Fragment, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState.js";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  /** Used for sort comparison; defaults to row[key] cast to string|number */
  sortValue?: (row: T) => string | number;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * If `renderExpanded` is set, clicking a row toggles an expanded panel that
 * renders below it; `onRowClick` is ignored in that case (put a nav button
 * inside the expanded panel if you need to navigate away).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  renderExpanded,
  emptyMessage = "No data.",
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  renderExpanded?: (row: T) => ReactNode;
  emptyMessage?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const sortValue = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number);
    return [...rows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const handleSort = (key: string) => {
    setSort((s) => {
      if (s?.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  const totalCols = columns.length + (renderExpanded ? 1 : 0);
  const rowInteractive = renderExpanded !== undefined || onRowClick !== undefined;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border">
          {renderExpanded && <th className="w-6 px-2 py-2" aria-hidden="true" />}
          {columns.map((c) => (
            <th
              key={c.key}
              className={`px-3 py-2 font-medium text-muted ${c.align === "right" ? "text-right" : "text-left"} ${
                c.sortable ? "cursor-pointer select-none" : ""
              }`}
              onClick={c.sortable ? () => handleSort(c.key) : undefined}
            >
              <span>{c.label}</span>
              {sort?.key === c.key && <span>{sort.dir === "asc" ? " ▲" : " ▼"}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => {
          const key = getRowKey(row);
          const isOpen = renderExpanded !== undefined && expanded.has(key);
          const handleRowClick = renderExpanded
            ? () => toggleExpand(key)
            : onRowClick
              ? () => onRowClick(row)
              : undefined;
          return (
            <Fragment key={key}>
              <tr
                className={`border-b border-border ${rowInteractive ? "cursor-pointer hover:bg-surface" : ""}`}
                onClick={handleRowClick}
              >
                {renderExpanded && (
                  <td className="w-6 px-2 py-2 text-muted select-none" aria-hidden="true">
                    <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  </td>
                )}
                {columns.map((c) => {
                  const value = c.render
                    ? c.render(row)
                    : (row as Record<string, unknown>)[c.key] as ReactNode;
                  return (
                    <td
                      key={c.key}
                      data-col={c.key}
                      className={`px-3 py-2 ${c.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {value as ReactNode}
                    </td>
                  );
                })}
              </tr>
              {isOpen && renderExpanded && (
                <tr className="border-b border-border bg-surface/50">
                  <td colSpan={totalCols} className="px-3 py-4">
                    {renderExpanded(row)}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
