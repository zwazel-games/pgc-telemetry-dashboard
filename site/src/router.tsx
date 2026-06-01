import { createRouter, createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";

const placeholder = (path: string, name: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <div className="text-muted">{name} — coming up</div>,
  });

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  placeholder("/players/$id", "Player history"),
  placeholder("/balance/powerups", "Powerup pick-rate"),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
