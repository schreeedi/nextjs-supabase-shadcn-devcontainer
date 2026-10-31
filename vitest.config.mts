import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      "**/node_modules/**",
      ".next/**",
      ".claude/**",
      "coverage/**",
      "dist/**",
    ],
    // Same zone as the devcontainer: "today" bugs (UTC vs. local day) show up
    // in tests everywhere, not just east of UTC.
    env: { TZ: "Europe/Berlin" },
    // Env, globals and vi.spyOn spies are reset after every test — no per-file
    // afterEach cleanup, no leaking into the next test. Fake timers: setup file.
    unstubEnvs: true,
    unstubGlobals: true,
    restoreMocks: true,
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "utils/**/*.ts", "scripts/**/*.mjs"],
      exclude: [
        "**/*.test.*",
        // Thin SDK/framework wrappers without own branches
        "lib/utils.ts",
        "utils/supabase/client.ts",
        "utils/supabase/server.ts",
        "utils/supabase/middleware.ts",
        "utils/supabase/service.ts",
        // Process entry points: env, client, signals — only wiring
        "scripts/worker.mjs",
        "scripts/build-worker-bundle.mjs",
      ],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
      // Ratchet: raise to just below the reached level as logic grows, never
      // lower it — new logic brings its tests.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
  resolve: {
    // Mirror the `@/*` -> `./*` alias from tsconfig.json
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
