import { createRoute, redirect } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeLoad: () => { throw redirect({ to: "/matches" as any }); },
});
