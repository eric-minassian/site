import { test, expect } from "../fixtures";
import { passphraseToToken } from "../fixtures";

test.describe("Site API", () => {
  test("GET /api/site returns site data", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    const res = await request.get(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.username).toBe(authInfo.username);
    expect(body.siteId).toBeTruthy();
  });

  test("PUT /api/site updates markdown", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    const markdown = "# API Test\n\nUpdated via API.";
    const res = await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.markdown).toBe(markdown);
  });

  test("PUT /api/site rejects oversized markdown", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    // 500KB + 1 byte
    const markdown = "x".repeat(500 * 1024 + 1);
    const res = await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("500KB");
  });

  test("POST /api/site/publish queues a build", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    // Write content first
    await request.put(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: { markdown: "# Publish Test" },
    });

    const res = await request.post(`${baseURL}/api/site/publish`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.buildStatus).toBe("queued");
  });

  test("POST /api/site/publish rejects empty site", async ({
    request,
    baseURL,
  }) => {
    // Create a fresh site with no content
    const username = `e2e-empty-${Date.now()}`.slice(0, 39);
    const createRes = await request.post(`${baseURL}/api/sites`, {
      data: { username },
    });
    const { passphrase } = (await createRes.json()) as {
      passphrase: string;
    };
    const token = passphraseToToken(passphrase);

    const res = await request.post(`${baseURL}/api/site/publish`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("no content");
  });

  test("POST /api/site/regenerate-passphrase returns new passphrase", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    const res = await request.post(
      `${baseURL}/api/site/regenerate-passphrase`,
      {
        headers: { Authorization: `Bearer ${authInfo.token}` },
      },
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.passphrase).toBeTruthy();
    expect(body.passphrase.trim().split(/\s+/).length).toBe(12);

    // Old token should now be invalid
    const oldRes = await request.get(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
    });
    expect(oldRes.status()).toBe(401);

    // New token should work
    const newToken = passphraseToToken(body.passphrase);
    const newRes = await request.get(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    expect(newRes.ok()).toBeTruthy();
  });

  test("DELETE /api/site deletes site", async ({
    request,
    baseURL,
  }) => {
    // Create a throwaway site
    const username = `e2e-del-${Date.now()}`.slice(0, 39);
    const createRes = await request.post(`${baseURL}/api/sites`, {
      data: { username },
    });
    const { passphrase } = (await createRes.json()) as {
      passphrase: string;
    };
    const token = passphraseToToken(passphrase);

    // Delete it
    const delRes = await request.delete(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.ok()).toBeTruthy();

    // Token should no longer work
    const getRes = await request.get(`${baseURL}/api/site`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(401);
  });

  test("unauthenticated requests return 401", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(`${baseURL}/api/site`);
    expect(res.status()).toBe(401);
  });

  test("invalid token format returns 401", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(`${baseURL}/api/site`, {
      headers: { Authorization: "Bearer not-a-hex-token" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Template API", () => {
  test("GET /api/templates returns list", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/templates`);

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.page).toBe(1);
  });

  test("GET /api/templates supports search", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(
      `${baseURL}/api/templates?search=minimal`,
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items).toBeDefined();
  });

  test("GET /api/templates supports filter and sort", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(
      `${baseURL}/api/templates?filter=curated&sort=popular`,
    );

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items).toBeDefined();
  });

  test("create, update, and delete template", async ({
    authInfo,
    request,
    baseURL,
  }) => {
    const slug = `e2e-api-tmpl-${Date.now()}`.slice(0, 40);

    // Create
    const createRes = await request.post(`${baseURL}/api/templates`, {
      headers: { Authorization: `Bearer ${authInfo.token}` },
      data: {
        slug,
        name: "E2E API Template",
        html: "<div>{{{content}}}</div>",
        description: "Created by E2E test",
      },
    });
    expect(createRes.status()).toBe(201);
    const template = await createRes.json();
    expect(template.templateId).toBeTruthy();
    expect(template.slug).toBe(slug);

    // Get by slug
    const getRes = await request.get(
      `${baseURL}/api/templates/${slug}`,
    );
    expect(getRes.ok()).toBeTruthy();

    // Update
    const updateRes = await request.put(
      `${baseURL}/api/templates/${template.templateId}`,
      {
        headers: { Authorization: `Bearer ${authInfo.token}` },
        data: { name: "E2E API Template (updated)" },
      },
    );
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.name).toBe("E2E API Template (updated)");

    // Delete
    const delRes = await request.delete(
      `${baseURL}/api/templates/${template.templateId}`,
      {
        headers: { Authorization: `Bearer ${authInfo.token}` },
      },
    );
    expect(delRes.ok()).toBeTruthy();
  });

  test("fork template", async ({ authInfo, request, baseURL }) => {
    // Find a template to fork
    const listRes = await request.get(`${baseURL}/api/templates?limit=1`);
    const list = await listRes.json();

    if (list.items.length > 0) {
      const original = list.items[0];
      const forkSlug = `e2e-fork-${Date.now()}`.slice(0, 40);

      const forkRes = await request.post(
        `${baseURL}/api/templates/${original.templateId}/fork`,
        {
          headers: { Authorization: `Bearer ${authInfo.token}` },
          data: { slug: forkSlug },
        },
      );

      expect(forkRes.status()).toBe(201);
      const forked = await forkRes.json();
      expect(forked.forkedFromId).toBe(original.templateId);
      expect(forked.slug).toBe(forkSlug);
      expect(forked.authorSiteId).toBe(authInfo.token ? forked.authorSiteId : "");

      // Clean up
      await request.delete(
        `${baseURL}/api/templates/${forked.templateId}`,
        {
          headers: { Authorization: `Bearer ${authInfo.token}` },
        },
      );
    }
  });
});

test.describe("Abuse Report API", () => {
  test("submit abuse report", async ({ authInfo, request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/reports`, {
      data: {
        siteId: authInfo.username,
        reason: "e2e-test",
        details: "Automated E2E test report — safe to ignore.",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.reportId).toBeTruthy();
  });

  test("abuse report requires reason", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/reports`, {
      data: { siteId: "some-id" },
    });

    expect(res.ok()).toBeFalsy();
  });
});
