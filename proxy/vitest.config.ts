import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            ALLOWED_ORIGIN: "http://localhost:5173",
            POSTHOG_API_KEY: "test-key",
          },
        },
      },
    },
  },
});
