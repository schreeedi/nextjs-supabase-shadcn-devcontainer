import { test, expect } from "./fixtures";

test("/app/dashboard without a session redirects to /login", async ({
  page,
}) => {
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("deep links keep their target in ?next=", async ({ page }) => {
  await page.goto("/app/dashboard?tab=billing");
  await expect(page).toHaveURL(
    "/login?next=%2Fapp%2Fdashboard%3Ftab%3Dbilling",
  );
});

test("/admin without a session redirects to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});
