import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Route as rootRoute } from "../../src/routes/__root.js";
import { Route as matchesRoute } from "../../src/routes/matches.js";

const server = setupServer(
  http.get("http://127.0.0.1:8787/maps",     () => HttpResponse.json({ data: { maps: ["arena_a", "arena_b"] }, generated_at: "t" })),
  http.get("http://127.0.0.1:8787/versions", () => HttpResponse.json({ data: { versions: ["1.0.0"] }, generated_at: "t" })),
  http.get("http://127.0.0.1:8787/matches",  () => HttpResponse.json({
    data: { matches: [{ match_id: "m1", started_at: "2026-05-01T00:00:00Z", map: "arena_a",
                        rounds: 5, players: 4, max_players: 8, round_duration_s: 60, version: "1.0.0",
                        is_steam: true }] },
    generated_at: "t",
  })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderRoute(initialPath: string) {
  const routeTree = rootRoute.addChildren([matchesRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("/matches", () => {
  it("renders matches table after load", async () => {
    renderRoute("/matches");
    await waitFor(() => expect(screen.getByText("m1")).toBeInTheDocument());
  });

  it("changing map filter triggers refetch with map param", async () => {
    renderRoute("/matches");
    await waitFor(() => expect(screen.getByText("All maps")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("All maps"), { target: { value: "arena_b" } });
    await waitFor(() => expect(screen.getByDisplayValue("arena_b")).toBeInTheDocument());
  });
});
