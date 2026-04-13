import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { render } from "@site/renderer";
import type { Site, Template } from "../api/lib/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const config = {
  get sitesTable() { return env("SITES_TABLE"); },
  get templatesTable() { return env("TEMPLATES_TABLE"); },
  get sitesBucket() { return env("SITES_BUCKET"); },
  get sitesDistributionId() { return env("SITES_DISTRIBUTION_ID"); },
};

// ---------------------------------------------------------------------------
// AWS Clients
// ---------------------------------------------------------------------------

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const cf = new CloudFrontClient({});

// ---------------------------------------------------------------------------
// Template sanitization
// ---------------------------------------------------------------------------

const DANGEROUS_TAGS = /(<\s*\/?\s*(?:script|noscript|iframe|embed|object|form)\b[^>]*>)/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URIS = /(?:href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;
const META_REFRESH = /<\s*meta\s+[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi;

function sanitizeTemplate(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JAVASCRIPT_URIS, "")
    .replace(META_REFRESH, "");
}

// ---------------------------------------------------------------------------
// Post-processing: inject CSP meta tag + abuse report link
// ---------------------------------------------------------------------------

const CSP_META = '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; frame-ancestors \'none\'">';

function injectCspMeta(html: string): string {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${CSP_META}\n</head>`);
  }
  return `${CSP_META}\n${html}`;
}

const ABUSE_LINK_STYLE =
  "text-align:center;padding:12px;font-size:12px;color:#888;font-family:system-ui,sans-serif";

function injectAbuseLink(html: string, siteId: string): string {
  const link = `<div style="${ABUSE_LINK_STYLE}"><a href="/report?site=${encodeURIComponent(siteId)}" style="color:#888;text-decoration:underline">Report abuse</a></div>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${link}\n</body>`);
  }
  return `${html}\n${link}`;
}

// ---------------------------------------------------------------------------
// Combine template HTML + CSS
// ---------------------------------------------------------------------------

function combineTemplateCss(templateHtml: string, css: string): string {
  if (!css) return templateHtml;
  const styleTag = `<style>${css}</style>`;
  if (templateHtml.includes("</head>")) {
    return templateHtml.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${templateHtml}`;
}

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

async function getSite(siteId: string): Promise<Site | null> {
  const result = await dynamo.send(
    new GetCommand({ TableName: config.sitesTable, Key: { siteId } }),
  );
  return (result.Item as Site | undefined) ?? null;
}

async function getTemplate(templateId: string): Promise<Template | null> {
  const result = await dynamo.send(
    new GetCommand({ TableName: config.templatesTable, Key: { templateId } }),
  );
  return (result.Item as Template | undefined) ?? null;
}

async function updateBuildStatus(
  siteId: string,
  buildStatus: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const updates: Record<string, unknown> = {
    buildStatus,
    updatedAt: new Date().toISOString(),
    ...extra,
  };

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const exprs: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    exprs.push(`#${key} = :${key}`);
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: config.sitesTable,
      Key: { siteId },
      UpdateExpression: `SET ${exprs.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

// ---------------------------------------------------------------------------
// Build a single site
// ---------------------------------------------------------------------------

async function buildSite(siteId: string): Promise<void> {
  // 1. Mark as building
  await updateBuildStatus(siteId, "building");

  // 2. Fetch site
  const site = await getSite(siteId);
  if (!site) throw new Error(`Site not found: ${siteId}`);
  if (!site.markdown) throw new Error(`Site has no content: ${siteId}`);

  // 3. Fetch and prepare template
  let templateHtml: string | undefined;
  if (site.templateId) {
    const tmpl = await getTemplate(site.templateId);
    if (tmpl) {
      templateHtml = sanitizeTemplate(tmpl.html);
      templateHtml = combineTemplateCss(templateHtml, tmpl.css);
    }
  }

  // 4. Render markdown with sanitization enabled
  const result = await render(site.markdown, {
    template: templateHtml,
    variables: site.templateVariables,
    sanitize: true,
  });

  // 5. Post-process: CSP meta tag + abuse link
  let finalHtml = injectCspMeta(result.html);
  finalHtml = injectAbuseLink(finalHtml, site.siteId);

  // 6. Upload to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: config.sitesBucket,
      Key: `sites/${site.username}/index.html`,
      Body: finalHtml,
      ContentType: "text/html; charset=utf-8",
      CacheControl: "public, max-age=86400",
    }),
  );

  // 7. Invalidate CloudFront cache
  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: config.sitesDistributionId,
      InvalidationBatch: {
        CallerReference: `${siteId}-${Date.now()}`,
        Paths: { Quantity: 1, Items: [`/${site.username}/*`] },
      },
    }),
  );

  // 8. Mark as success
  await updateBuildStatus(siteId, "success", {
    status: "live",
    lastBuildAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// SQS Handler
// ---------------------------------------------------------------------------

interface SqsEvent {
  Records: Array<{ body: string; messageId: string }>;
}

export const handler = async (event: SqsEvent): Promise<void> => {
  for (const record of event.Records) {
    const { siteId } = JSON.parse(record.body) as { siteId: string };
    console.log(`Building site ${siteId} (message: ${record.messageId})`);

    try {
      await buildSite(siteId);
      console.log(`Build succeeded for site ${siteId}`);
    } catch (err) {
      console.error(`Build failed for site ${siteId}:`, err);
      try {
        await updateBuildStatus(siteId, "failed");
      } catch {
        console.error(`Failed to update build status for site ${siteId}`);
      }
      throw err; // Re-throw so SQS retries / sends to DLQ
    }
  }
};
