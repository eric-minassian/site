import { test, expect } from "../fixtures";

test.describe("Builder", () => {
  test("write markdown and see save indicator", async ({ authedPage: page }) => {
    await page.goto("/builder");
    await expect(page.getByText("Editor")).toBeVisible();

    // CodeMirror editor should be present
    const editor = page.locator(".cm-editor");
    await expect(editor).toBeVisible();

    // Click into the editor and type markdown
    await editor.locator(".cm-content").click();
    await page.keyboard.type("# Hello E2E Test\n\nThis is a test.");

    // Wait for auto-save — should show "Saved" indicator
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  });

  test("template selector is available", async ({ authedPage: page }) => {
    await page.goto("/builder");
    await expect(page.getByText("Editor")).toBeVisible();

    // Template controls section should be present
    // The template select trigger should exist
    const templateSection = page.locator("[data-slot='select-trigger']").first();
    await expect(templateSection).toBeVisible();
  });

  test("live preview renders content", async ({ authedPage: page }) => {
    await page.goto("/builder");

    // The preview iframe should exist
    const preview = page.locator("iframe");
    await expect(preview).toBeVisible();
  });
});
