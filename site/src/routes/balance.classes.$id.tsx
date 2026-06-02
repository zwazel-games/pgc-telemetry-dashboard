import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { usePickDetail } from "../api/queries.js";
import { PickDetailPage } from "../components/balance/PickDetailPage.js";
import { validateDetailSearch } from "../lib/balance.js";

function Page() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/balance/classes/$id" as any });
  const q = usePickDetail("class", id, { since: search.since, until: search.until });
  return (
    <PickDetailPage
      id={id}
      label="Class"
      listPath="/balance/classes"
      detailPath="/balance/classes/$id"
      preset={search.preset}
      view={search.view}
      q={q}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate={navigate as any}
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/balance/classes/$id",
  component: Page,
  validateSearch: validateDetailSearch,
});
