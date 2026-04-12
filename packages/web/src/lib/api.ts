const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = (await res.json()) as T & { error?: string };

  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  return body;
}

export function createSite(username: string) {
  return request<{ siteId: string; username: string; passphrase: string }>(
    "/api/sites",
    { method: "POST", body: JSON.stringify({ username }) },
  );
}

export function getSite(token: string) {
  return request<{
    siteId: string;
    username: string;
    title: string;
    markdown: string;
    templateId: string | null;
    templateVariables: Record<string, string>;
    status: string;
    buildStatus: string;
    createdAt: string;
    updatedAt: string;
    lastBuildAt: string | null;
  }>("/api/site", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function regeneratePassphrase(token: string) {
  return request<{ passphrase: string }>("/api/site/regenerate-passphrase", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
