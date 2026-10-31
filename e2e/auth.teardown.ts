import { test as teardown } from "@playwright/test";
import { deleteUser, E2E_USERS } from "./users";

teardown("delete E2E users", async () => {
  for (const user of Object.values(E2E_USERS)) await deleteUser(user);
});
