import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";

// GitHub Pages serves 404.html for any path it can't match to a real file.
// Copying index.html to dist/404.html means deep-link reloads (e.g.,
// /players/p_xxx) still load the SPA bundle; TanStack Router then resolves
// the URL client-side. The page status is 404, but the bundle runs normally.
const spa404Fallback = {
  name: "spa-404-fallback",
  closeBundle() {
    copyFileSync("dist/index.html", "dist/404.html");
  },
};

export default defineConfig(({ command }) => ({
  plugins: [react(), spa404Fallback],
  // GitHub Pages serves this site at /pgc-telemetry-dashboard/. Dev keeps the
  // default root base so localhost:5173 works without a subpath.
  base: command === "build" ? "/pgc-telemetry-dashboard/" : "/",
  server: { port: 5173 },
}));
