import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";
import { Route as playerRoute } from "./routes/players.$id.js";
import { Route as powerupsRoute } from "./routes/balance.powerups.js";

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  playerRoute,
  powerupsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
