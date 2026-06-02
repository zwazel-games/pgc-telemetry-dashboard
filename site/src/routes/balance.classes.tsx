import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePickrate } from "../api/queries.js";
import { PickratePage } from "../components/balance/PickratePage.js";
import { validatePickrateSearch } from "../lib/balance.js";

function Page() {
  const search = Route.useSearch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/balance/classes" as any });
  const q = usePickrate("class", { since: search.since, until: search.until });
  return (
    <PickratePage
      title="Class pick-rate"
      label="Class"
      detailPath="/balance/classes/$id"
      preset={search.preset}
      q={q}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate={navigate as any}
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/balance/classes",
  component: Page,
  validateSearch: validatePickrateSearch,
});
