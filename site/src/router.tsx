import { createRouter, createHashHistory } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root.js";
import { Route as indexRoute } from "./routes/index.js";
import { Route as matchesRoute } from "./routes/matches.js";
import { Route as matchDetailRoute } from "./routes/matches.$id.js";
import { Route as playerRoute } from "./routes/players.$id.js";
import { Route as powerupsRoute } from "./routes/balance.powerups.js";
import { Route as powerupDetailRoute } from "./routes/balance.powerups.$id.js";
import { Route as classesRoute } from "./routes/balance.classes.js";
import { Route as classDetailRoute } from "./routes/balance.classes.$id.js";
import { Route as weaponsRoute } from "./routes/balance.weapons.js";
import { Route as weaponDetailRoute } from "./routes/balance.weapons.$id.js";

const routeTree = rootRoute.addChildren([
  indexRoute,
  matchesRoute,
  matchDetailRoute,
  playerRoute,
  powerupsRoute,
  powerupDetailRoute,
  classesRoute,
  classDetailRoute,
  weaponsRoute,
  weaponDetailRoute,
]);

// Hash history: all client-side routing lives after the URL hash (e.g.,
// /pgc-telemetry-dashboard/#/players/p_xxx). This means deep-link reloads
// work on any static host with no special config — the hash never reaches
// the server, so Pages just serves index.html. As a bonus, GitHub Pages's
// real 404 page still surfaces for genuinely wrong paths like
// /pgc-telemetry-dashboard/garbage, instead of the SPA hijacking them.
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}
