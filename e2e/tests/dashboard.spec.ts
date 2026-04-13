import { test, expect } from "../fixtures";

test.describe("Dashboard", () => {
  test("shows site overview with username", async ({
    authedPage: page,
    authInfo,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText(authInfo.username)).toBeVisible();
    await expect(page.getByText("Site Overview")).toBeVisible();
  });

  test("shows edit and template links", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: /edit content/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /change template/i }),
    ).toBeVisible();
  });

  test("publish button disabled when no content", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");

    const publishBtn = page.getByRole("button", { name: /publish/i });
    await expect(publishBtn).toBeVisible();
    // New site has no markdown, so publish should be disabled
    await expect(publishBtn).toBeDisabled();
  });

  test("publish site after writing content", async ({
    authedPage: page,
    authInfo,
    request,
    baseURL,
  }) => {
    // Write markdown via API
    await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown: "# E2E Test Site\n\nHello world." },
    });

    await page.goto("/dashboard");

    const publishBtn = page.getByRole("button", { name: /publish/i });
    await expect(publishBtn).toBeEnabled({ timeout: 5000 });
    await publishBtn.click();

    // Should show build status
    await expect(page.getByText(/queued|building/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("build completes after publish", async ({
    authedPage: page,
    authInfo,
    request,
    baseURL,
  }) => {
    // Write and publish via API
    await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown: "# Build Complete Test" },
    });
    await request.post(`${baseURL}/api/site/publish`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
    });

    await page.goto("/dashboard");

    // Poll until build finishes (success or failed)
    await expect(
      page.getByText(/Live|Build failed/i),
    ).toBeVisible({ timeout: 30000 });
  });

  test("custom domain section visible", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Custom Domain")).toBeVisible();
    await expect(page.getByText(/connect your own domain/i)).toBeVisible();
  });

  test("custom domain form validates input", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");

    const domainInput = page.getByPlaceholder("example.com");
    await expect(domainInput).toBeVisible();

    // Empty domain — button disabled
    await expect(
      page.getByRole("button", { name: "Add domain" }),
    ).toBeDisabled();

    // Fill a domain — button enabled
    await domainInput.fill("test.example.com");
    await expect(
      page.getByRole("button", { name: "Add domain" }),
    ).toBeEnabled();
  });

  test("passphrase regeneration flow", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Passphrase")).toBeVisible();

    // Click regenerate
    await page
      .getByRole("button", { name: /regenerate passphrase/i })
      .click();

    // Confirmation dialog
    await expect(page.getByText("Regenerate passphrase?")).toBeVisible();
    await expect(page.getByText("cannot be undone")).toBeVisible();

    // Confirm regeneration
    await page.getByRole("button", { name: "Regenerate" }).click();

    // Should show new passphrase
    await expect(
      page.getByText("Save your new passphrase"),
    ).toBeVisible({ timeout: 10000 });

    // New passphrase should be 12 words
    const passphraseEl = page.locator("p.font-mono");
    const newPassphrase = (await passphraseEl.textContent()) ?? "";
    expect(newPassphrase.trim().split(/\s+/).length).toBe(12);

    // Close dialog
    await page
      .getByRole("button", { name: /saved my passphrase/i })
      .click();
  });

  test("delete site section visible", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Delete Site")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /delete my site/i }),
    ).toBeVisible();
  });

  test("delete site requires confirmation", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /delete my site/i }).click();

    // Confirmation dialog appears
    await expect(page.getByText("Delete your site?")).toBeVisible();
    await expect(page.getByText(/permanently delete/i)).toBeVisible();

    // Delete button disabled until "delete" is typed
    const deleteBtn = page.getByRole("button", {
      name: "Delete permanently",
    });
    await expect(deleteBtn).toBeDisabled();

    // Type wrong confirmation
    await page.getByPlaceholder(/type "delete"/i).fill("nope");
    await expect(deleteBtn).toBeDisabled();

    // Type correct confirmation
    await page.getByPlaceholder(/type "delete"/i).fill("delete");
    await expect(deleteBtn).toBeEnabled();
  });

  test("delete site and redirect", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /delete my site/i }).click();
    await page.getByPlaceholder(/type "delete"/i).fill("delete");
    await page
      .getByRole("button", { name: "Delete permanently" })
      .click();

    // Should log out and redirect away from dashboard
    await expect(page).not.toHaveURL("/dashboard", { timeout: 10000 });
  });
});
