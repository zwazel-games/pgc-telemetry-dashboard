import { useMemo, useState, type ReactNode } from "react";

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

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No data.",
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);

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

  if (rows.length === 0) return <div className="text-muted py-8">{emptyMessage}</div>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border">
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
        {sortedRows.map((row) => (
          <tr
            key={getRowKey(row)}
            className={`border-b border-border ${onRowClick ? "cursor-pointer hover:bg-surface" : ""}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
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
        ))}
      </tbody>
    </table>
  );
}
