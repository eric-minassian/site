import { test, expect } from "../fixtures";

test.describe("Abuse reporting", () => {
  test("submit abuse report via API", async ({
    authInfo,
    request,
    baseURL,
  }) => {
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

  test("abuse report requires siteId and reason", async ({
    request,
    baseURL,
  }) => {
    // Missing reason
    const res1 = await request.post(`${baseURL}/api/reports`, {
      data: { siteId: "some-id" },
    });
    expect(res1.ok()).toBeFalsy();

    // Missing siteId
    const res2 = await request.post(`${baseURL}/api/reports`, {
      data: { reason: "spam" },
    });
    expect(res2.ok()).toBeFalsy();
  });
});
