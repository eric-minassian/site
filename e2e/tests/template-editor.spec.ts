import { test, expect } from "../fixtures";

test.describe("Template Editor", () => {
  test("create new template page loads", async ({ authedPage: page }) => {
    await page.goto("/templates/new");

    // Should show template editor with name and slug inputs
    await expect(page.getByPlaceholder("Template name")).toBeVisible();
    await expect(page.getByPlaceholder("slug")).toBeVisible();

    // Should show HTML/CSS/Variables tabs
    await expect(page.getByRole("tab", { name: "HTML" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "CSS" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Variables/ })).toBeVisible();

    // Publish button present
    await expect(
      page.getByRole("button", { name: "Publish" }),
    ).toBeVisible();
  });

  test("create and publish a template", async ({ authedPage: page }) => {
    const slug = `e2e-tmpl-${Date.now()}`.slice(0, 30);

    await page.goto("/templates/new");

    // Fill in metadata
    await page.getByPlaceholder("Template name").fill("E2E Test Template");
    await page.getByPlaceholder("slug").fill(slug);

    // Type HTML into the code editor
    const htmlEditor = page.locator(".cm-editor").first();
    await htmlEditor.locator(".cm-content").click();
    await page.keyboard.type(
      "<!DOCTYPE html><html><head><title>{{title}}</title></head><body>{{{content}}}</body></html>",
    );

    // Click publish
    await page.getByRole("button", { name: "Publish" }).click();

    // Should show "Saved" indicator
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 10000 });

    // URL should change to edit path
    await expect(page).toHaveURL(new RegExp(`/templates/${slug}/edit`));
  });

  test("live preview updates as HTML is typed", async ({
    authedPage: page,
  }) => {
    await page.goto("/templates/new");

    // Type HTML
    const htmlEditor = page.locator(".cm-editor").first();
    await htmlEditor.locator(".cm-content").click();
    await page.keyboard.type("<h1>Preview Test</h1>{{{content}}}");

    // Preview iframe should exist and render
    const preview = page.locator("iframe");
    await expect(preview).toBeVisible();
  });

  test("requires name and slug and HTML to publish", async ({
    authedPage: page,
  }) => {
    await page.goto("/templates/new");

    // Click publish without filling anything
    await page.getByRole("button", { name: "Publish" }).click();

    // Should show validation error
    await expect(page.getByText(/required/i)).toBeVisible();
  });
});
