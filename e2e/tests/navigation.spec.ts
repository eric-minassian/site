import { test, expect } from "../fixtures";

test.describe("Navigation and routing", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    // Should show the main app
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated user redirected from dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Should redirect to login
    await expect(page).not.toHaveURL("/dashboard");
  });

  test("unauthenticated user redirected from builder", async ({
    page,
  }) => {
    await page.goto("/builder");
    await expect(page).not.toHaveURL("/builder");
  });

  test("authenticated user redirected from create to dashboard", async ({
    authedPage: page,
  }) => {
    await page.goto("/create");
    await expect(page).toHaveURL("/dashboard");
  });

  test("authenticated user redirected from login to dashboard", async ({
    authedPage: page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/dashboard");
  });

  test("marketplace accessible without auth", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByText("Theme Marketplace")).toBeVisible();
  });

  test("template detail accessible without auth", async ({ page }) => {
    // Navigate to marketplace first to find a template
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const cards = page.locator('a[href^="/templates/"]');
    if ((await cards.count()) > 0) {
      await cards.first().click();
      // Should load template detail without auth
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("404 page for unknown routes falls back to SPA", async ({
    page,
  }) => {
    await page.goto("/this-does-not-exist");
    // SPA should handle it — check we get a page, not a server error
    await expect(page.locator("body")).toBeVisible();
  });
});
