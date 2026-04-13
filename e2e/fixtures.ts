import { createHash } from "node:crypto";
import { test as base, type Page } from "@playwright/test";

/** Derive auth token from passphrase — mirrors packages/web/src/lib/crypto.ts */
export function passphraseToToken(passphrase: string): string {
  const normalized = passphrase.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export interface AuthInfo {
  username: string;
  passphrase: string;
  token: string;
}

/** Generate a unique username for test isolation */
function testUsername(): string {
  const id = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-${id}`.slice(0, 39);
}

export const test = base.extend<{
  /** Credentials for a freshly-created test site */
  authInfo: AuthInfo;
  /** A page already logged in via localStorage injection */
  authedPage: Page;
}>({
  authInfo: async ({ request, baseURL }, use) => {
    const username = testUsername();
    const res = await request.post(`${baseURL}/api/sites`, {
      data: { username },
    });
    const body = (await res.json()) as {
      passphrase: string;
      siteId: string;
      username: string;
    };
    const token = passphraseToToken(body.passphrase);
    await use({ username, passphrase: body.passphrase, token });
  },

  authedPage: async ({ page, authInfo, baseURL }, use) => {
    await page.goto(baseURL!);
    await page.evaluate(
      ({ token, username }) => {
        localStorage.setItem("site_auth_token", token);
        localStorage.setItem("site_auth_username", username);
      },
      { token: authInfo.token, username: authInfo.username },
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
