import { randomUUID } from "node:crypto";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  CloudFrontKeyValueStoreClient,
  DeleteKeyCommand,
  DescribeKeyValueStoreCommand,
  PutKeyCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";
import { config } from "../lib/config";
import {
  createReport,
  deleteSite,
  deleteTemplate,
  getSiteById,
  getTemplatesByAuthor,
  updateSite,
} from "../lib/db";
import { checkReportRateLimit } from "../lib/rate-limit";
import { error, json } from "../lib/response";
import type { ApiResponse, LambdaUrlEvent, Report } from "../lib/types";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const sns = new SNSClient({});
const kvsClient = new CloudFrontKeyValueStoreClient({ region: "us-east-1" });
const s3 = new S3Client({});

const VALID_REASONS = [
  "spam",
  "malware",
  "phishing",
  "harassment",
  "copyright",
  "illegal",
  "other",
];

function parseBody(event: LambdaUrlEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString()
    : event.body;
  return JSON.parse(raw) as Record<string, unknown>;
}

function checkAdmin(event: LambdaUrlEvent): boolean {
  const token = config.adminToken;
  if (!token) return false;
  const header = event.headers["authorization"];
  if (!header) return false;
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;
  return bearer === token;
}

// POST /api/reports
export async function handleCreateReport(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const sourceIp = event.requestContext.http.sourceIp;
  if (!checkReportRateLimit(sourceIp)) {
    return error(429, "Rate limit exceeded. Try again later.");
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (!body.siteId || typeof body.siteId !== "string") {
    return error(400, "siteId is required");
  }

  if (!body.reason || typeof body.reason !== "string") {
    return error(400, "reason is required");
  }

  if (!VALID_REASONS.includes(body.reason)) {
    return error(
      400,
      `reason must be one of: ${VALID_REASONS.join(", ")}`,
    );
  }

  const site = await getSiteById(body.siteId);
  if (!site) {
    return error(404, "Site not found");
  }

  const report: Report = {
    reportId: randomUUID(),
    siteId: body.siteId,
    reason: body.reason,
    details: typeof body.details === "string" ? body.details.slice(0, 2000) : null,
    email: typeof body.email === "string" ? body.email.slice(0, 320) : null,
    sourceIp,
    createdAt: new Date().toISOString(),
  };

  await createReport(report);

  await sns.send(
    new PublishCommand({
      TopicArn: config.reportsTopicArn,
      Subject: `Abuse report: ${site.username} (${report.reason})`,
      Message: JSON.stringify({
        reportId: report.reportId,
        siteId: report.siteId,
        username: site.username,
        reason: report.reason,
        details: report.details,
        createdAt: report.createdAt,
      }),
    }),
  );

  return json(201, { reportId: report.reportId });
}

// POST /api/admin/suspend
export async function handleSuspendSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  if (!checkAdmin(event)) return error(403, "Forbidden");

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (!body.siteId || typeof body.siteId !== "string") {
    return error(400, "siteId is required");
  }

  const site = await getSiteById(body.siteId);
  if (!site) return error(404, "Site not found");

  if (site.suspended) {
    return error(409, "Site is already suspended");
  }

  // Set suspended flag in DB
  await updateSite(site.siteId, {
    suspended: true,
    updatedAt: new Date().toISOString(),
  });

  // Add to KVS suspension list
  const kvsArn = config.sitesKvsArn;
  const desc = await kvsClient.send(
    new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }),
  );
  await kvsClient.send(
    new PutKeyCommand({
      KvsARN: kvsArn,
      Key: `suspended:${site.username}`,
      Value: "1",
      IfMatch: desc.ETag ?? "",
    }),
  );

  return json(200, { suspended: true, username: site.username });
}

// POST /api/admin/unsuspend
export async function handleUnsuspendSite(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  if (!checkAdmin(event)) return error(403, "Forbidden");

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (!body.siteId || typeof body.siteId !== "string") {
    return error(400, "siteId is required");
  }

  const site = await getSiteById(body.siteId);
  if (!site) return error(404, "Site not found");

  if (!site.suspended) {
    return error(409, "Site is not suspended");
  }

  // Clear suspended flag in DB
  await updateSite(site.siteId, {
    suspended: false,
    updatedAt: new Date().toISOString(),
  });

  // Remove from KVS suspension list
  try {
    const kvsArn = config.sitesKvsArn;
    const desc = await kvsClient.send(
      new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }),
    );
    await kvsClient.send(
      new DeleteKeyCommand({
        KvsARN: kvsArn,
        Key: `suspended:${site.username}`,
        IfMatch: desc.ETag ?? "",
      }),
    );
  } catch {
    // Key might not exist in KVS
  }

  return json(200, { suspended: false, username: site.username });
}

// DELETE /api/admin/sites/:siteId
export async function handleAdminDeleteSite(
  event: LambdaUrlEvent,
  params: Record<string, string>,
): Promise<ApiResponse> {
  if (!checkAdmin(event)) return error(403, "Forbidden");

  const { siteId } = params;
  const site = await getSiteById(siteId);
  if (!site) return error(404, "Site not found");

  // Remove suspension from KVS if suspended
  if (site.suspended) {
    try {
      const kvsArn = config.sitesKvsArn;
      const desc = await kvsClient.send(
        new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }),
      );
      await kvsClient.send(
        new DeleteKeyCommand({
          KvsARN: kvsArn,
          Key: `suspended:${site.username}`,
          IfMatch: desc.ETag ?? "",
        }),
      );
    } catch {
      // Key might not exist
    }
  }

  // Cascade: delete authored templates
  const templates = await getTemplatesByAuthor(site.siteId);
  await Promise.all(templates.map((t) => deleteTemplate(t.templateId)));

  // Cascade: delete S3 objects
  await deleteS3Prefix(config.assetsBucket, `assets/${site.siteId}/`);
  await deleteS3Prefix(config.sitesBucket, `${site.username}/`);

  await deleteSite(site.siteId);

  return json(200, { deleted: true, username: site.username });
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
