import { randomUUID } from "node:crypto";
import { authenticate, isError } from "../lib/auth";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplateBySlug,
  getTemplatesByAuthorFull,
  scanAllTemplates,
  updateTemplate,
} from "../lib/db";
import { error, json } from "../lib/response";
import type {
  ApiResponse,
  LambdaUrlEvent,
  Template,
  TemplateVariable,
} from "../lib/types";

const SLUG_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const MAX_HTML_SIZE = 100_000;
const MAX_CSS_SIZE = 50_000;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_VARIABLES = 50;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const VALID_VARIABLE_TYPES = new Set([
  "color",
  "font",
  "number",
  "select",
  "text",
]);

function parseBody(event: LambdaUrlEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString()
    : event.body;
  return JSON.parse(raw) as Record<string, unknown>;
}

function parseQuery(qs: string): Record<string, string> {
  if (!qs) return {};
  const params: Record<string, string> = {};
  for (const pair of qs.split("&")) {
    const idx = pair.indexOf("=");
    if (idx === -1) {
      params[decodeURIComponent(pair)] = "";
    } else {
      params[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(
        pair.slice(idx + 1),
      );
    }
  }
  return params;
}

function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug)) {
    return "Slug must be 3-64 characters, start with a letter, contain only lowercase letters, numbers, and hyphens, and not end with a hyphen";
  }
  return null;
}

function validateVariable(v: unknown): string | null {
  if (typeof v !== "object" || v === null) return "Variable must be an object";
  const obj = v as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name.trim())
    return "Variable name is required";
  if (typeof obj.label !== "string" || !obj.label.trim())
    return "Variable label is required";
  if (!VALID_VARIABLE_TYPES.has(obj.type as string))
    return `Variable type must be one of: color, font, number, select, text`;
  if (typeof obj.default !== "string")
    return "Variable default value is required";
  if (
    obj.type === "select" &&
    (!Array.isArray(obj.options) || obj.options.length === 0)
  ) {
    return "Select variables must have options";
  }
  return null;
}

function sanitizeVariable(v: Record<string, unknown>): TemplateVariable {
  const result: TemplateVariable = {
    name: (v.name as string).trim(),
    label: (v.label as string).trim(),
    type: v.type as TemplateVariable["type"],
    default: v.default as string,
  };
  if (v.type === "select" && Array.isArray(v.options)) {
    result.options = v.options.filter(
      (o): o is string => typeof o === "string",
    );
  }
  return result;
}

function templateResponse(template: Template) {
  return {
    templateId: template.templateId,
    authorSiteId: template.authorSiteId,
    slug: template.slug,
    name: template.name,
    description: template.description,
    html: template.html,
    css: template.css,
    variables: template.variables,
    isCurated: template.isCurated,
    forkedFromId: template.forkedFromId,
    usageCount: template.usageCount,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function templateSummary(template: Template) {
  return {
    templateId: template.templateId,
    authorSiteId: template.authorSiteId,
    slug: template.slug,
    name: template.name,
    description: template.description,
    variables: template.variables,
    isCurated: template.isCurated,
    forkedFromId: template.forkedFromId,
    usageCount: template.usageCount,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

// GET /api/templates — public, paginated list with search/filter/sort
export async function handleListTemplates(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const query = parseQuery(event.rawQueryString);
  const search = query.search?.toLowerCase();
  const filter = query.filter as "curated" | "community" | undefined;
  const sort = query.sort === "popular" ? "popular" : "newest";
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );

  // Check if requesting templates by author
  const authorSiteId = query.author;
  let templates: Template[];

  if (authorSiteId) {
    templates = await getTemplatesByAuthorFull(authorSiteId);
  } else {
    templates = await scanAllTemplates();
  }

  // Filter
  let filtered = templates;
  if (filter === "curated") {
    filtered = filtered.filter((t) => t.isCurated);
  } else if (filter === "community") {
    filtered = filtered.filter((t) => !t.isCurated);
  }

  if (search) {
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search),
    );
  }

  // Sort
  if (sort === "popular") {
    filtered.sort((a, b) => b.usageCount - a.usageCount);
  } else {
    filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return json(200, {
    items: items.map(templateSummary),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
}

// GET /api/templates/:slug — public
export async function handleGetTemplate(
  _event: LambdaUrlEvent,
  params: Record<string, string>,
): Promise<ApiResponse> {
  const { slug } = params;
  const template = await getTemplateBySlug(slug);
  if (!template) {
    return error(404, "Template not found");
  }
  return json(200, templateResponse(template));
}

// POST /api/templates — auth required
export async function handleCreateTemplate(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const authResult = await authenticate(event);
  if (isError(authResult)) return authResult;

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  // Validate required fields
  if (!body.slug || typeof body.slug !== "string") {
    return error(400, "Slug is required");
  }
  if (!body.name || typeof body.name !== "string") {
    return error(400, "Name is required");
  }
  if (!body.html || typeof body.html !== "string") {
    return error(400, "HTML is required");
  }

  const slug = (body.slug as string).toLowerCase().trim();
  const slugErr = validateSlug(slug);
  if (slugErr) return error(400, slugErr);

  const name = (body.name as string).trim();
  if (name.length > MAX_NAME_LENGTH) {
    return error(400, `Name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return error(
      400,
      `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  const html = (body.html as string).trim();
  if (html.length > MAX_HTML_SIZE) {
    return error(400, `HTML must be at most ${MAX_HTML_SIZE} bytes`);
  }

  const css = typeof body.css === "string" ? body.css.trim() : "";
  if (css.length > MAX_CSS_SIZE) {
    return error(400, `CSS must be at most ${MAX_CSS_SIZE} bytes`);
  }

  // Validate variables
  const variables: TemplateVariable[] = [];
  if (body.variables !== undefined) {
    if (!Array.isArray(body.variables)) {
      return error(400, "Variables must be an array");
    }
    if (body.variables.length > MAX_VARIABLES) {
      return error(400, `Maximum ${MAX_VARIABLES} variables allowed`);
    }
    for (const v of body.variables) {
      const varErr = validateVariable(v);
      if (varErr) return error(400, varErr);
      variables.push(sanitizeVariable(v as Record<string, unknown>));
    }
  }

  // Check slug uniqueness
  const existing = await getTemplateBySlug(slug);
  if (existing) {
    return error(409, "A template with this slug already exists");
  }

  const now = new Date().toISOString();
  const template: Template = {
    templateId: randomUUID(),
    authorSiteId: authResult.siteId,
    slug,
    name,
    description,
    html,
    css,
    variables,
    isCurated: false,
    forkedFromId: null,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await createTemplate(template);

  return json(201, templateResponse(template));
}

// PUT /api/templates/:id — auth required, must be author
export async function handleUpdateTemplate(
  event: LambdaUrlEvent,
  params: Record<string, string>,
): Promise<ApiResponse> {
  const authResult = await authenticate(event);
  if (isError(authResult)) return authResult;

  const { id } = params;
  const template = await getTemplateById(id);
  if (!template) {
    return error(404, "Template not found");
  }

  if (template.authorSiteId !== authResult.siteId) {
    return error(403, "You can only edit your own templates");
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return error(400, "Name must be a non-empty string");
    }
    const name = body.name.trim();
    if (name.length > MAX_NAME_LENGTH) {
      return error(400, `Name must be at most ${MAX_NAME_LENGTH} characters`);
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      return error(400, "Description must be a string");
    }
    const description = body.description.trim();
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return error(
        400,
        `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
      );
    }
    updates.description = description;
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== "string") {
      return error(400, "Slug must be a string");
    }
    const slug = body.slug.toLowerCase().trim();
    const slugErr = validateSlug(slug);
    if (slugErr) return error(400, slugErr);

    if (slug !== template.slug) {
      const existing = await getTemplateBySlug(slug);
      if (existing) {
        return error(409, "A template with this slug already exists");
      }
      updates.slug = slug;
    }
  }

  if (body.html !== undefined) {
    if (typeof body.html !== "string" || !body.html.trim()) {
      return error(400, "HTML must be a non-empty string");
    }
    const html = body.html.trim();
    if (html.length > MAX_HTML_SIZE) {
      return error(400, `HTML must be at most ${MAX_HTML_SIZE} bytes`);
    }
    updates.html = html;
  }

  if (body.css !== undefined) {
    if (typeof body.css !== "string") {
      return error(400, "CSS must be a string");
    }
    const css = body.css.trim();
    if (css.length > MAX_CSS_SIZE) {
      return error(400, `CSS must be at most ${MAX_CSS_SIZE} bytes`);
    }
    updates.css = css;
  }

  if (body.variables !== undefined) {
    if (!Array.isArray(body.variables)) {
      return error(400, "Variables must be an array");
    }
    if (body.variables.length > MAX_VARIABLES) {
      return error(400, `Maximum ${MAX_VARIABLES} variables allowed`);
    }
    const variables: TemplateVariable[] = [];
    for (const v of body.variables) {
      const varErr = validateVariable(v);
      if (varErr) return error(400, varErr);
      variables.push(sanitizeVariable(v as Record<string, unknown>));
    }
    updates.variables = variables;
  }

  if (Object.keys(updates).length === 0) {
    return error(400, "No valid fields to update");
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await updateTemplate(id, updates);
  if (!updated) {
    return error(404, "Template not found");
  }

  return json(200, templateResponse(updated));
}

// DELETE /api/templates/:id — auth required, must be author
export async function handleDeleteTemplate(
  event: LambdaUrlEvent,
  params: Record<string, string>,
): Promise<ApiResponse> {
  const authResult = await authenticate(event);
  if (isError(authResult)) return authResult;

  const { id } = params;
  const template = await getTemplateById(id);
  if (!template) {
    return error(404, "Template not found");
  }

  if (template.authorSiteId !== authResult.siteId) {
    return error(403, "You can only delete your own templates");
  }

  await deleteTemplate(id);

  return json(200, { deleted: true });
}

// POST /api/templates/:id/fork — auth required
export async function handleForkTemplate(
  event: LambdaUrlEvent,
  params: Record<string, string>,
): Promise<ApiResponse> {
  const authResult = await authenticate(event);
  if (isError(authResult)) return authResult;

  const { id } = params;
  const original = await getTemplateById(id);
  if (!original) {
    return error(404, "Template not found");
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  // Require a new slug for the fork
  if (!body.slug || typeof body.slug !== "string") {
    return error(400, "Slug is required for the forked template");
  }

  const slug = (body.slug as string).toLowerCase().trim();
  const slugErr = validateSlug(slug);
  if (slugErr) return error(400, slugErr);

  const existing = await getTemplateBySlug(slug);
  if (existing) {
    return error(409, "A template with this slug already exists");
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `${original.name} (fork)`;

  const now = new Date().toISOString();
  const forked: Template = {
    templateId: randomUUID(),
    authorSiteId: authResult.siteId,
    slug,
    name,
    description: original.description,
    html: original.html,
    css: original.css,
    variables: [...original.variables],
    isCurated: false,
    forkedFromId: original.templateId,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await createTemplate(forked);

  return json(201, templateResponse(forked));
}
