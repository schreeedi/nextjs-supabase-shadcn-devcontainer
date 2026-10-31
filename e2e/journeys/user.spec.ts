import { test, expect } from "../fixtures";
import { STORAGE } from "../storage";
import { E2E_USERS, signIn } from "../users";

// Journeys of a signed-in Free user. Sign-in itself is OAuth (not clickable
// in tests); the session comes from a service-role magic link (e2e/users.ts).

test.describe("signed-in user", () => {
  test.use({ storageState: STORAGE.user });
  const { email, fullName } = E2E_USERS.user;

  test("sees their profile and plan on the dashboard", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.getByText(fullName)).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();
    await expect(page.getByText("Your plan:")).toContainText("Free");
  });

  test("gets an upgrade hint for a Pro feature", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(
      page.getByRole("link", { name: "Upgrade to Pro" }),
    ).toBeVisible();
    await expect(page.getByText("Data export available")).toHaveCount(0);
  });

  test("is sent from /login straight to the dashboard", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/app/dashboard");
  });

  test("sees the Dashboard link instead of Log in on the home page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Dashboard" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  });

  test("gets a 404 for the admin console", async ({ page }) => {
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Page not found");
  });
});

test("sign out ends the session", async ({ page, context, baseURL }) => {
  await signIn(context, E2E_USERS.leaver, baseURL!);
  await page.goto("/app/dashboard");
  await expect(page.locator("h1")).toHaveText("Dashboard");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
