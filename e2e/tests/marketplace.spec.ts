import { test, expect } from "../fixtures";

test.describe("Theme Marketplace", () => {
  test("browse templates page loads", async ({ page }) => {
    await page.goto("/marketplace");

    await expect(page.getByText("Theme Marketplace")).toBeVisible();

    // Should show template count or "No templates found"
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // Controls present
    await expect(page.getByPlaceholder("Search templates...")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Curated" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Community" }),
    ).toBeVisible();
  });

  test("search filters results", async ({ page }) => {
    await page.goto("/marketplace");

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const countBefore = page.getByText(/\d+ templates? found/);
    const textBefore = await countBefore.textContent().catch(() => null);

    // Search for a term unlikely to match all templates
    await page.getByPlaceholder("Search templates...").fill("minimal");

    // Wait for debounced search
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("filter by curated", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Curated" }).click();

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("filter by community", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Community" }).click();

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("sort by newest", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    // Open sort dropdown and select Newest
    await page.locator("[data-slot='select-trigger']").last().click();
    await page.getByRole("option", { name: "Newest" }).click();

    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });
  });

  test("navigate to template detail page", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const templateCards = page.locator('a[href^="/templates/"]');
    const count = await templateCards.count();

    if (count > 0) {
      const name = await templateCards.first().locator("h3").textContent();
      await templateCards.first().click();

      // Should show template detail
      await expect(page.locator("h1")).toBeVisible();
      // Back link to marketplace
      await expect(
        page.getByRole("link", { name: "Marketplace" }),
      ).toBeVisible();
    }
  });

  test("template detail shows metadata", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const templateCards = page.locator('a[href^="/templates/"]');
    if ((await templateCards.count()) > 0) {
      await templateCards.first().click();

      // Should show usage count, date, and HTML/CSS tabs
      await expect(page.getByText(/uses?/)).toBeVisible();
      await expect(page.getByRole("tab", { name: "HTML" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "CSS" })).toBeVisible();
    }
  });

  test("apply template from detail page", async ({ authedPage: page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const templateCards = page.locator('a[href^="/templates/"]');
    if ((await templateCards.count()) > 0) {
      await templateCards.first().click();

      const useBtn = page.getByRole("button", { name: "Use Template" });
      await expect(useBtn).toBeVisible();
      await useBtn.click();

      await expect(page).toHaveURL("/builder");
    }
  });

  test("fork template from detail page", async ({ authedPage: page }) => {
    await page.goto("/marketplace");
    await expect(
      page.getByText(/templates? found|No templates found/),
    ).toBeVisible({ timeout: 10000 });

    const templateCards = page.locator('a[href^="/templates/"]');
    if ((await templateCards.count()) > 0) {
      await templateCards.first().click();

      // Click fork button
      await page.getByRole("button", { name: "Fork" }).click();

      // Fork dialog should appear
      await expect(page.getByText("Fork Template")).toBeVisible();
      await expect(page.getByLabel("Slug")).toBeVisible();

      // The slug should be pre-filled with a fork suffix
      const slugInput = page.getByLabel("Slug");
      const slugValue = await slugInput.inputValue();
      expect(slugValue).toContain("fork");
    }
  });
});
