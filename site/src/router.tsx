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

// Vite's import.meta.env.BASE_URL is "/" in dev and "/pgc-telemetry-dashboard/"
// in the production build (see vite.config.ts). Strip the trailing slash for
// TanStack Router's basepath, which expects no trailing slash and treats "" /
// undefined as root.
const basepath = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export const router = createRouter({ routeTree, basepath });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
