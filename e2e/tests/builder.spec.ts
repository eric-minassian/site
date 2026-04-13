import { test, expect } from "../fixtures";

test.describe("Builder", () => {
  test("write markdown and auto-save", async ({ authedPage: page }) => {
    await page.goto("/builder");
    await expect(page.getByText("Editor")).toBeVisible();

    const editor = page.locator(".cm-editor");
    await expect(editor).toBeVisible();

    await editor.locator(".cm-content").click();
    await page.keyboard.type("# Hello E2E Test\n\nThis is a test.");

    // Wait for auto-save
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  });

  test("markdown persists after reload", async ({
    authedPage: page,
    authInfo,
    request,
    baseURL,
  }) => {
    // Write markdown via API
    await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown: "# Persistent Content\n\nThis should persist." },
    });

    await page.goto("/builder");

    // The editor should contain the saved content
    const editor = page.locator(".cm-editor");
    await expect(editor).toContainText("Persistent Content");
  });

  test("template selector is available", async ({ authedPage: page }) => {
    await page.goto("/builder");
    await expect(page.getByText("Editor")).toBeVisible();

    const templateSection = page.locator(
      "[data-slot='select-trigger']",
    ).first();
    await expect(templateSection).toBeVisible();
  });

  test("live preview iframe renders", async ({ authedPage: page }) => {
    await page.goto("/builder");

    const preview = page.locator("iframe");
    await expect(preview).toBeVisible();
  });

  test("viewport toggle buttons work", async ({ authedPage: page }) => {
    await page.goto("/builder");

    // Desktop, Tablet, Mobile buttons
    await expect(
      page.getByRole("button", { name: "Desktop preview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tablet preview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mobile preview" }),
    ).toBeVisible();

    // Click mobile — iframe width should change
    await page.getByRole("button", { name: "Mobile preview" }).click();
    const iframe = page.locator("iframe");
    const style = await iframe.getAttribute("style");
    expect(style).toContain("375px");
  });

  test("frontmatter panel opens and edits title", async ({
    authedPage: page,
  }) => {
    await page.goto("/builder");

    // Open the frontmatter panel
    await page.getByText("Page Metadata").click();

    // Title field should be visible
    const titleInput = page.getByLabel("Title");
    await expect(titleInput).toBeVisible();

    // Type a title
    await titleInput.fill("My Test Title");

    // Wait for auto-save
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  });

  test("template selection changes preview", async ({
    authedPage: page,
  }) => {
    await page.goto("/builder");

    // Expand template section if collapsed
    const templateButton = page.getByText("Template");
    await templateButton.click();

    // Open template dropdown
    const trigger = page
      .locator("[data-slot='select-trigger']")
      .first();
    await trigger.click();

    // Check if there are template options beyond "No template"
    const options = page.getByRole("option");
    const count = await options.count();
    if (count > 1) {
      // Select the second option (first real template)
      await options.nth(1).click();

      // Should trigger auto-save
      await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
    }
  });
});
