import { test, expect } from "@playwright/test";
import { passphraseToToken } from "../fixtures";

test.describe("Site creation and login", () => {
  const username = `e2e-${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 39);
  let passphrase = "";

  test("create a new site and display passphrase", async ({ page }) => {
    await page.goto("/create");

    // Fill in username and submit
    await page.getByPlaceholder("username").fill(username);
    await page.getByRole("button", { name: "Create site" }).click();

    // Should show passphrase step
    await expect(page.getByText("Save your passphrase")).toBeVisible();
    await expect(page.getByText("never be shown again")).toBeVisible();

    // Grab the passphrase text
    const passphraseEl = page.locator("p.font-mono");
    await expect(passphraseEl).toBeVisible();
    passphrase = (await passphraseEl.textContent()) ?? "";
    const wordCount = passphrase.trim().split(/\s+/).length;
    expect(wordCount).toBe(12);

    // Click continue to go to dashboard
    await page.getByRole("button", { name: /saved my passphrase/i }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("log out and log back in with passphrase", async ({ page }) => {
    // Ensure we have a passphrase from the previous test
    expect(passphrase).toBeTruthy();

    // Set up auth from previous step then log out
    const token = passphraseToToken(passphrase);
    await page.goto("/");
    await page.evaluate(
      ({ t, u }) => {
        localStorage.setItem("site_auth_token", t);
        localStorage.setItem("site_auth_username", u);
      },
      { t: token, u: username },
    );
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /log out/i }).click();

    // Should be on home or login
    await page.goto("/login");

    // Enter passphrase
    await page.getByPlaceholder(/12-word passphrase/i).fill(passphrase);
    await expect(page.getByText("12/12 words")).toBeVisible();

    // Submit
    await page.getByRole("button", { name: "Log in" }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText(username)).toBeVisible();
  });
});
