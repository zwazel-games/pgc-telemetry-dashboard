import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePickrate } from "../api/queries.js";
import { PickratePage } from "../components/balance/PickratePage.js";
import { validatePickrateSearch } from "../lib/balance.js";

function Page() {
  const search = Route.useSearch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/balance/weapons" as any });
  const q = usePickrate("weapon", { since: search.since, until: search.until });
  return (
    <PickratePage
      title="Weapon pick-rate"
      label="Weapon"
      detailPath="/balance/weapons/$id"
      preset={search.preset}
      q={q}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate={navigate as any}
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/balance/weapons",
  component: Page,
  validateSearch: validatePickrateSearch,
});
