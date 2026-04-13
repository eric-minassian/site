const API_BASE = import.meta.env.VITE_API_URL ?? "";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_MARKDOWN_SIZE = 500 * 1024; // 500KB per R39

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  name: string;
  label: string;
  type: "color" | "font" | "number" | "select" | "text";
  default: string;
  options?: string[];
}

export interface TemplateSummary {
  templateId: string;
  authorSiteId: string;
  slug: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
  isCurated: boolean;
  forkedFromId: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  html: string;
  css: string;
}

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
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
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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
    customDomain: string | null;
    customDomainStatus: "pending_validation" | "active" | "failed" | null;
    lastBuildAt: string | null;
  }>("/api/site", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateSite(
  token: string,
  updates: {
    title?: string;
    markdown?: string;
    templateId?: string | null;
    templateVariables?: Record<string, string>;
  },
) {
  if (updates.markdown && updates.markdown.length > MAX_MARKDOWN_SIZE) {
    return Promise.reject(new ApiError(400, "Markdown content exceeds maximum size of 500KB"));
  }
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
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
}

export function deleteSite(token: string) {
  return request<{ deleted: boolean }>("/api/site", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function regeneratePassphrase(token: string) {
  return request<{ passphrase: string }>("/api/site/regenerate-passphrase", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

function requestImageUpload(
  token: string,
  hash: string,
  contentType: string,
  size: number,
) {
  return request<{ uploadUrl: string; imageUrl: string }>("/api/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ hash, contentType, size }),
  });
}

export async function uploadImage(
  token: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("File type not allowed. Use PNG, JPEG, GIF, WebP, or SVG.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("File too large. Maximum size is 2MB.");
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { uploadUrl, imageUrl } = await requestImageUpload(
    token,
    hash,
    file.type,
    file.size,
  );

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Failed to upload image to storage");
  }

  return imageUrl;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function getTemplates(params?: {
  search?: string;
  filter?: string;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.filter) qs.set("filter", params.filter);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return request<{
    items: TemplateSummary[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>(`/api/templates${query ? `?${query}` : ""}`);
}

export function getTemplateBySlug(slug: string) {
  return request<TemplateDetail>(
    `/api/templates/${encodeURIComponent(slug)}`,
  );
}

export function createTemplate(
  token: string,
  data: {
    slug: string;
    name: string;
    description?: string;
    html: string;
    css?: string;
    variables?: TemplateVariable[];
  },
) {
  return request<TemplateDetail>("/api/templates", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function updateTemplate(
  token: string,
  templateId: string,
  data: {
    slug?: string;
    name?: string;
    description?: string;
    html?: string;
    css?: string;
    variables?: TemplateVariable[];
  },
) {
  return request<TemplateDetail>(
    `/api/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    },
  );
}

export function deleteTemplate(token: string, templateId: string) {
  return request<{ deleted: boolean }>(
    `/api/templates/${encodeURIComponent(templateId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export function forkTemplate(
  token: string,
  templateId: string,
  data: { slug: string; name?: string },
) {
  return request<TemplateDetail>(
    `/api/templates/${encodeURIComponent(templateId)}/fork`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    },
  );
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export function publishSite(token: string) {
  return request<{ buildStatus: string }>("/api/site/publish", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Custom Domains
// ---------------------------------------------------------------------------

export interface DomainStatus {
  domain: string | null;
  status: "pending_validation" | "active" | "failed" | null;
  validationRecords: Array<{ name: string; value: string }> | null;
}

export interface DomainAddResult extends DomainStatus {
  instructions: string;
}

export function addCustomDomain(token: string, domain: string) {
  return request<DomainAddResult>("/api/site/custom-domain", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ domain }),
  });
}

export function getCustomDomainStatus(token: string) {
  return request<DomainStatus>("/api/site/custom-domain", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function removeCustomDomain(token: string) {
  return request<{ removed: boolean }>("/api/site/custom-domain", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
