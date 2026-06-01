import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "../../src/components/DataTable.js";

type Row = { name: string; n: number };
const cols: Column<Row>[] = [
  { key: "name",  label: "Name", sortable: true },
  { key: "n",     label: "N",    sortable: true, align: "right" },
];
const rows: Row[] = [
  { name: "alpha", n: 3 },
  { name: "beta",  n: 1 },
  { name: "gamma", n: 2 },
];

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("sorts by clicked column ascending then descending", () => {
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} />);
    fireEvent.click(screen.getByText("N"));
    let cells = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-col") === "n");
    expect(cells.map((c) => c.textContent)).toEqual(["1", "2", "3"]);
    fireEvent.click(screen.getByText("N"));
    cells = screen.getAllByRole("cell").filter((c) => c.getAttribute("data-col") === "n");
    expect(cells.map((c) => c.textContent)).toEqual(["3", "2", "1"]);
  });

  it("fires onRowClick", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={cols} rows={rows} getRowKey={(r) => r.name} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("alpha"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: "alpha" }));
  });
});
