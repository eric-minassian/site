import { test, expect } from "../fixtures";
import { passphraseToToken } from "../fixtures";

test.describe("Site creation", () => {
  test("create a new site and display 12-word passphrase", async ({
    page,
  }) => {
    const username = `e2e-${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 39);

    await page.goto("/create");
    await page.getByPlaceholder("username").fill(username);
    await page.getByRole("button", { name: "Create site" }).click();

    // Should show passphrase step
    await expect(page.getByText("Save your passphrase")).toBeVisible();
    await expect(page.getByText("never be shown again")).toBeVisible();

    // Passphrase should be 12 words
    const passphraseEl = page.locator("p.font-mono");
    await expect(passphraseEl).toBeVisible();
    const passphrase = (await passphraseEl.textContent()) ?? "";
    expect(passphrase.trim().split(/\s+/).length).toBe(12);

    // Continue to dashboard
    await page.getByRole("button", { name: /saved my passphrase/i }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText(username)).toBeVisible();
  });

  test("reject duplicate username", async ({ page, authInfo }) => {
    await page.goto("/create");
    // Use the username already created by the authInfo fixture
    await page.getByPlaceholder("username").fill(authInfo.username);
    await page.getByRole("button", { name: "Create site" }).click();

    await expect(page.getByText(/already taken/i)).toBeVisible();
  });

  test("reject invalid username", async ({ page }) => {
    await page.goto("/create");

    // Too short — button should be disabled with minLength=3
    await page.getByPlaceholder("username").fill("ab");
    await expect(
      page.getByRole("button", { name: "Create site" }),
    ).toBeDisabled();
  });
});

test.describe("Login", () => {
  test("log in with valid passphrase", async ({ page, authInfo }) => {
    await page.goto("/login");

    await page
      .getByPlaceholder(/12-word passphrase/i)
      .fill(authInfo.passphrase);
    await expect(page.getByText("12/12 words")).toBeVisible();

    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText(authInfo.username)).toBeVisible();
  });

  test("reject invalid passphrase", async ({ page }) => {
    await page.goto("/login");

    await page
      .getByPlaceholder(/12-word passphrase/i)
      .fill("wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong");

    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/invalid passphrase/i)).toBeVisible();
  });

  test("disable login button until 12 words entered", async ({ page }) => {
    await page.goto("/login");

    // With fewer than 12 words the button is disabled
    await page.getByPlaceholder(/12-word passphrase/i).fill("one two three");
    await expect(page.getByText("3/12 words")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeDisabled();
  });

  test("log out clears auth", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByRole("button", { name: /log out/i }).click();

    // Should redirect to home or login
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL("/dashboard");
  });
});
