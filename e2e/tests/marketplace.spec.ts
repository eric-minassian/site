import { test, expect } from "../fixtures";

test.describe("Theme Marketplace", () => {
  test("browse templates", async ({ page }) => {
    await page.goto("/marketplace");

    await expect(page.getByText("Theme Marketplace")).toBeVisible();

    // Should show template count or "No templates found"
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // Search input should be present
    await expect(page.getByPlaceholder("Search templates...")).toBeVisible();

    // Filter buttons should be present
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Curated" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Community" })).toBeVisible();
  });

  test("search templates", async ({ page }) => {
    await page.goto("/marketplace");

    // Wait for initial load
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // Type a search query
    await page.getByPlaceholder("Search templates...").fill("minimal");

    // Wait for debounced search to complete
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("filter by curated", async ({ page }) => {
    await page.goto("/marketplace");

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // Click the Curated filter
    await page.getByRole("button", { name: "Curated" }).click();

    // Should reload templates
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("navigate to template detail page", async ({ page }) => {
    await page.goto("/marketplace");

    // Wait for templates to load
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // If templates exist, click the first one
    const templateCards = page.locator('a[href^="/templates/"]');
    const count = await templateCards.count();
    if (count > 0) {
      await templateCards.first().click();

      // Should be on a template detail page
      await expect(page.getByText("Marketplace").first()).toBeVisible();

      // Should show template details
      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("apply template from detail page", async ({ authedPage: page }) => {
    await page.goto("/marketplace");

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const templateCards = page.locator('a[href^="/templates/"]');
    const count = await templateCards.count();
    if (count > 0) {
      await templateCards.first().click();

      // Click "Use Template" button
      const useBtn = page.getByRole("button", { name: "Use Template" });
      await expect(useBtn).toBeVisible();
      await useBtn.click();

      // Should navigate to builder
      await expect(page).toHaveURL("/builder");
    }
  });
});
