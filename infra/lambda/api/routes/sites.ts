import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { authenticate, isError } from "../lib/auth";
import { config } from "../lib/config";
import { computeKeyHash, generatePassphrase } from "../lib/crypto";
import {
  createSite,
  deleteSite,
  deleteTemplate,
  getSiteByUsername,
  getTemplatesByAuthor,
  updateSite,
} from "../lib/db";
import { checkRateLimit } from "../lib/rate-limit";
import { error, json } from "../lib/response";
import type { ApiResponse, LambdaUrlEvent, Site } from "../lib/types";

const sqs = new SQSClient({});
const s3 = new S3Client({});

const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "www",
  "mail",
  "smtp",
  "ftp",
  "ssh",
  "blog",
  "help",
  "support",
  "status",
  "docs",
  "about",
  "terms",
  "privacy",
  "contact",
  "login",
  "signup",
  "register",
  "settings",
  "dashboard",
  "account",
  "billing",
  "pricing",
  "static",
  "assets",
  "cdn",
  "media",
  "images",
  "js",
  "css",
  "fonts",
  "public",
  "system",
  "root",
  "null",
  "undefined",
  "test",
  "dev",
  "staging",
  "prod",
  "production",
]);

const USERNAME_RE = /^[a-z][a-z0-9-]{1,37}[a-z0-9]$/;
const MAX_MARKDOWN_SIZE = 500 * 1024; // 500KB per R39

function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3-39 characters, start with a letter, contain only lowercase letters, numbers, and hyphens, and not end with a hyphen";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "This username is reserved";
  }
  return null;
}

function parseBody(event: LambdaUrlEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString()
    : event.body;
  return JSON.parse(raw) as Record<string, unknown>;
}

function siteResponse(site: Site) {
  return {
    siteId: site.siteId,
    username: site.username,
    title: site.title,
    markdown: site.markdown,
    templateId: site.templateId,
    templateVariables: site.templateVariables,
    status: site.status,
    buildStatus: site.buildStatus,
    customDomain: site.customDomain,
    customDomainStatus: site.customDomainStatus,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    lastBuildAt: site.lastBuildAt,
  };
}

// POST /api/sites
export async function handleCreateSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const sourceIp = event.requestContext.http.sourceIp;
  if (!checkRateLimit(sourceIp)) {
    return error(429, "Rate limit exceeded. Maximum 5 sites per hour.");
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (!body.username || typeof body.username !== "string") {
    return error(400, "Username is required");
  }

  const username = body.username.toLowerCase().trim();
  const usernameErr = validateUsername(username);
  if (usernameErr) {
    return error(400, usernameErr);
  }

  const existing = await getSiteByUsername(username);
  if (existing) {
    return error(409, "Username already taken");
  }

  const passphrase = generatePassphrase();
  const keyHash = computeKeyHash(passphrase);
  const now = new Date().toISOString();

  const site: Site = {
    siteId: randomUUID(),
    username,
    keyHash,
    title: "",
    markdown: "",
    templateId: null,
    templateVariables: {},
    status: "draft",
    buildStatus: "idle",
    customDomain: null,
    customDomainStatus: null,
    customDomainCertArn: null,
    customDomainValidation: null,
    createdAt: now,
    updatedAt: now,
    lastBuildAt: null,
  };

  await createSite(site);

  return json(201, {
    siteId: site.siteId,
    username: site.username,
    passphrase,
  });
}

// GET /api/site
export async function handleGetSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;
  return json(200, siteResponse(result));
}

// PUT /api/site
export async function handleUpdateSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  // Validate markdown size before accepting
  if (typeof body.markdown === "string" && body.markdown.length > MAX_MARKDOWN_SIZE) {
    return error(400, "Markdown content exceeds maximum size of 500KB");
  }

  const allowedKeys = [
    "title",
    "markdown",
    "templateId",
    "templateVariables",
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return error(400, "No valid fields to update");
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await updateSite(result.siteId, updates);
  if (!updated) {
    return error(404, "Site not found");
  }

  return json(200, siteResponse(updated));
}

// DELETE /api/site
export async function handleDeleteSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  // Cascade: delete authored templates
  const templates = await getTemplatesByAuthor(result.siteId);
  const results = await Promise.allSettled(templates.map((t) => deleteTemplate(t.templateId)));
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("Failed to delete template during site cascade:", r.reason);
    }
  }

  // Cascade: delete S3 objects
  await deleteS3Prefix(config.assetsBucket, `assets/${result.siteId}/`);
  await deleteS3Prefix(config.sitesBucket, `${result.username}/`);

  await deleteSite(result.siteId);

  return json(200, { deleted: true });
}

// POST /api/site/publish
export async function handlePublishSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  if (!result.markdown) {
    return error(400, "Site has no content to publish");
  }

  await updateSite(result.siteId, {
    buildStatus: "queued",
    updatedAt: new Date().toISOString(),
  });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: config.buildQueueUrl,
      MessageBody: JSON.stringify({ siteId: result.siteId }),
    }),
  );

  return json(200, { buildStatus: "queued" });
}

// POST /api/site/regenerate-passphrase
export async function handleRegeneratePassphrase(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  const passphrase = generatePassphrase();
  const keyHash = computeKeyHash(passphrase);

  await updateSite(result.siteId, {
    keyHash,
    updatedAt: new Date().toISOString(),
  });

  return json(200, { passphrase });
}

async function deleteS3Prefix(
  bucket: string,
  prefix: string,
): Promise<void> {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );

  const objects = list.Contents;
  if (!objects || objects.length === 0) return;

  const keys = objects
    .map((o) => o.Key)
    .filter((k): k is string => k !== undefined)
    .map((Key) => ({ Key }));

  if (keys.length === 0) return;

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys },
    }),
  );
}
