import { test, expect } from "../fixtures";

test.describe("Dashboard", () => {
  test("shows site overview", async ({ authedPage: page, authInfo }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText(authInfo.username)).toBeVisible();
    await expect(page.getByText("Site Overview")).toBeVisible();
  });

  test("shows edit and template links", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: /edit content/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /change template/i })).toBeVisible();
  });

  test("publish button present", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    // Publish button should exist (may be disabled if no markdown)
    await expect(page.getByRole("button", { name: /publish/i })).toBeVisible();
  });

  test("publish site after writing content", async ({
    authedPage: page,
    authInfo,
    request,
    baseURL,
  }) => {
    // Write markdown via API so publish is enabled
    await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown: "# E2E Test Site\n\nHello world." },
    });

    await page.goto("/dashboard");

    const publishBtn = page.getByRole("button", { name: /publish/i });
    await expect(publishBtn).toBeEnabled({ timeout: 5000 });
    await publishBtn.click();

    // Should show build queued/building status
    await expect(
      page.getByText(/queued|building/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("custom domain section visible", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Custom Domain")).toBeVisible();
    await expect(page.getByText(/connect your own domain/i)).toBeVisible();
  });

  test("custom domain form accepts input", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    const domainInput = page.getByPlaceholder("example.com");
    await expect(domainInput).toBeVisible();

    await domainInput.fill("test.example.com");
    const addBtn = page.getByRole("button", { name: "Add domain" });
    await expect(addBtn).toBeEnabled();
  });

  test("passphrase section visible", async ({ authedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Passphrase")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /regenerate passphrase/i }),
    ).toBeVisible();
  });
});
