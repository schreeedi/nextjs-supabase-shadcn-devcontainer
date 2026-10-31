import { defineConfig, devices } from "@playwright/test";
import { E2E_USERS } from "./e2e/users";

// Supabase URL/keys for the setup (service role → test users) from
// .env.local — in CI create it first: `npm run db:start && npm run env:local`.
try {
  process.loadEnvFile(".env.local");
} catch {
  throw new Error(
    "E2E needs .env.local with the local Supabase keys — run npm run env:local.",
  );
}

const PORT = 3100;

// E2E against a production build (AGENTS.md: dev and prod differ — static
// rendering, CSP, proxy) on its own port, so a running `npm start`/`npm run
// dev` on :3000 is left alone. Needs the local Supabase stack.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /auth\.teardown\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health/live`,
    // Never reuse: the server must run with the E2E admin id below.
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ADMIN_USER_IDS: E2E_USERS.admin.id },
  },
});
