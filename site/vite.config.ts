import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this site at /pgc-telemetry-dashboard/. Dev keeps the
  // default root base so localhost:5173 works without a subpath. Routing
  // happens entirely after the URL hash (see router.tsx), so this only
  // affects where built assets are loaded from.
  base: command === "build" ? "/pgc-telemetry-dashboard/" : "/",
  server: { port: 5173 },
}));
