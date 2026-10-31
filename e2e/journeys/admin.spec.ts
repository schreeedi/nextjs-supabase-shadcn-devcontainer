import { test, expect } from "../fixtures";
import { STORAGE } from "../storage";
import { E2E_USERS, serviceClient, signIn } from "../users";

test.use({ storageState: STORAGE.admin });

test("admin console lists users and queues", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("h1")).toHaveText("Admin");
  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: E2E_USERS.member.email }),
  ).toBeVisible();
});

// Cross-user journey: the admin upgrades a member, the member's own gates
// follow (same profiles.plan column billing writes), and the change is audited.
test("admin changes a member's plan and the member gets the feature", async ({
  page,
  browser,
  baseURL,
}) => {
  const { member } = E2E_USERS;
  // Arrange: Free, also when this test is retried or repeated.
  await serviceClient()
    .from("profiles")
    .update({ plan: "free" })
    .eq("id", member.id);

  await page.goto("/admin");
  await page.getByRole("link", { name: member.email }).click();
  await expect(page.locator("h1")).toHaveText(member.email);

  await page.getByLabel("Plan").selectOption("pro");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Plan changed to pro.");
  await expect(
    page.getByRole("heading", { name: "Admin actions on this user" }),
  ).toBeVisible();
  await expect(page.getByText("plan_change").first()).toBeVisible();

  const memberContext = await browser.newContext();
  await signIn(memberContext, member, baseURL!);
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/app/dashboard");
  await expect(memberPage.getByText("Your plan:")).toContainText("Pro");
  await expect(memberPage.getByText("Data export available")).toBeVisible();
  await memberContext.close();
});
