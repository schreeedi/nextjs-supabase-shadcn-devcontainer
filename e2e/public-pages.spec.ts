import { test, expect } from "./fixtures";

const pages = [
  { path: "/", h1: "Your work, all in one place" },
  { path: "/login", h1: "Welcome back" },
  { path: "/signup", h1: "Create your account" },
  { path: "/error", h1: "Authentication error" },
];

for (const { path, h1 } of pages) {
  test(`${path} renders with exactly one h1`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(h1);
    // No placeholder links (removed until the legal pages exist).
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });
}

test("unknown paths show the custom 404", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page).toHaveTitle(/Page not found/);
});

test("OAuth buttons are offered on /login", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Facebook" }),
  ).toBeVisible();
});
