import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authenticate, isError } from "../lib/auth";
import { config } from "../lib/config";
import { error, json } from "../lib/response";
import type { ApiResponse, LambdaUrlEvent } from "../lib/types";

const s3 = new S3Client({});

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const PRESIGN_EXPIRY = 300; // 5 minutes

function parseBody(event: LambdaUrlEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString()
    : event.body;
  return JSON.parse(raw) as Record<string, unknown>;
}

async function getTotalAssetSize(siteId: string): Promise<number> {
  const prefix = `assets/${siteId}/`;
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.assetsBucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of list.Contents ?? []) {
      totalSize += obj.Size ?? 0;
    }
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  return totalSize;
}

// POST /api/images
export async function handleRequestUpload(
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

  const { hash, contentType, size } = body;

  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
    return error(400, "Invalid hash: must be a 64-character hex SHA-256");
  }
  if (typeof contentType !== "string" || !ALLOWED_TYPES[contentType]) {
    return error(
      400,
      `Invalid content type. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`,
    );
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_FILE_SIZE) {
    return error(400, `File size must be between 1 byte and 2MB`);
  }

  const totalSize = await getTotalAssetSize(result.siteId);
  if (totalSize + size > MAX_TOTAL_SIZE) {
    return error(
      400,
      `Storage limit exceeded. Used: ${Math.round(totalSize / 1024)}KB of 10MB`,
    );
  }

  const ext = ALLOWED_TYPES[contentType];
  const key = `assets/${result.siteId}/${hash}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.assetsBucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: PRESIGN_EXPIRY },
  );

  const imageUrl = `${config.assetsCdnUrl}/${key}`;

  return json(200, { uploadUrl, imageUrl });
}
