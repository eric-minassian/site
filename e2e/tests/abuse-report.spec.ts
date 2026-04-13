import { test, expect } from "../fixtures";

test.describe("Abuse reporting", () => {
  test("submit abuse report via API", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    // Create a report against the test site
    const res = await request.post(`${baseURL}/api/reports`, {
      data: {
        siteId: authInfo.username,
        reason: "e2e-test",
        details: "Automated E2E test report — safe to ignore.",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { reportId: string };
    expect(body.reportId).toBeTruthy();
  });
});
