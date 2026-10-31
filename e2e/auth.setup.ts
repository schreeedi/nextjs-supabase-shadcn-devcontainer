import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { E2E_USERS, recreateUser, signIn } from "./users";
import { STORAGE } from "./storage";

// Users first, then sessions — in this order.
setup.describe.configure({ mode: "serial" });

setup("create E2E users", async () => {
  for (const user of Object.values(E2E_USERS)) await recreateUser(user);
});

// Saved sessions for the read-only journeys; the others sign in inline.
for (const role of ["user", "admin"] as const) {
  setup(`session for ${role}`, async ({ context, baseURL }) => {
    await signIn(context, E2E_USERS[role], baseURL!);
    mkdirSync("e2e/.auth", { recursive: true });
    await context.storageState({ path: STORAGE[role] });
  });
}
