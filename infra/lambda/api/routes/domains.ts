import {
  ACMClient,
  DeleteCertificateCommand,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  ValidationMethod,
} from "@aws-sdk/client-acm";
import {
  CloudFrontKeyValueStoreClient,
  DeleteKeyCommand,
  PutKeyCommand,
  DescribeKeyValueStoreCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";
import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import { authenticate, isError } from "../lib/auth";
import { config } from "../lib/config";
import { getSiteByCustomDomain, updateSite } from "../lib/db";
import { error, json } from "../lib/response";
import type { ApiResponse, LambdaUrlEvent } from "../lib/types";

// ACM certs for CloudFront must be in us-east-1
const acm = new ACMClient({ region: "us-east-1" });
const kvsClient = new CloudFrontKeyValueStoreClient({ region: "us-east-1" });
const cfClient = new CloudFrontClient({ region: "us-east-1" });

const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function parseBody(event: LambdaUrlEvent): Record<string, unknown> {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString()
    : event.body;
  return JSON.parse(raw) as Record<string, unknown>;
}

// POST /api/site/custom-domain
export async function handleAddCustomDomain(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  if (result.customDomain) {
    return error(
      409,
      "Site already has a custom domain. Remove it before adding a new one.",
    );
  }

  let body: Record<string, unknown>;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (!body.domain || typeof body.domain !== "string") {
    return error(400, "domain is required");
  }

  const domain = body.domain.toLowerCase().trim();

  if (domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return error(400, "Invalid domain format");
  }

  // Check domain not already used by another site
  const existing = await getSiteByCustomDomain(domain);
  if (existing) {
    return error(409, "Domain is already in use by another site");
  }

  // Request ACM certificate with DNS validation
  const certResult = await acm.send(
    new RequestCertificateCommand({
      DomainName: domain,
      ValidationMethod: ValidationMethod.DNS,
      Tags: [
        { Key: "site-platform", Value: "custom-domain" },
        { Key: "siteId", Value: result.siteId },
      ],
    }),
  );

  const certArn = certResult.CertificateArn;
  if (!certArn) {
    return error(500, "Failed to request certificate");
  }

  // Poll briefly to get validation records (ACM needs a moment)
  let validationRecords: Array<{ name: string; value: string }> = [];
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const desc = await acm.send(
      new DescribeCertificateCommand({ CertificateArn: certArn }),
    );
    const opts =
      desc.Certificate?.DomainValidationOptions?.[0]?.ResourceRecord;
    if (opts?.Name && opts?.Value) {
      validationRecords = [{ name: opts.Name, value: opts.Value }];
      break;
    }
  }

  const now = new Date().toISOString();
  await updateSite(result.siteId, {
    customDomain: domain,
    customDomainStatus: "pending_validation",
    customDomainCertArn: certArn,
    customDomainValidation: validationRecords,
    updatedAt: now,
  });

  return json(200, {
    domain,
    status: "pending_validation",
    validationRecords,
    instructions:
      "Add the CNAME record(s) above to your DNS provider, then point your domain to the sites distribution via CNAME.",
  });
}

// DELETE /api/site/custom-domain
export async function handleRemoveCustomDomain(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  if (!result.customDomain) {
    return error(404, "No custom domain configured");
  }

  // Remove from KVS if active
  if (result.customDomainStatus === "active") {
    try {
      const kvsArn = config.sitesKvsArn;
      const desc = await kvsClient.send(
        new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }),
      );
      await kvsClient.send(
        new DeleteKeyCommand({
          KvsARN: kvsArn,
          Key: `domain:${result.customDomain}`,
          IfMatch: desc.ETag ?? "",
        }),
      );
    } catch (err) {
      console.error(`Failed to remove domain ${result.customDomain} from KVS:`, err);
    }

    // Remove alternate domain from CloudFront distribution
    try {
      await removeAlternateDomain(
        config.sitesDistributionId,
        result.customDomain,
      );
    } catch (err) {
      console.error(`Failed to remove alternate domain ${result.customDomain} from CloudFront:`, err);
    }
  }

  // Delete ACM certificate
  if (result.customDomainCertArn) {
    try {
      await acm.send(
        new DeleteCertificateCommand({
          CertificateArn: result.customDomainCertArn,
        }),
      );
    } catch (err) {
      console.error(`Failed to delete ACM certificate ${result.customDomainCertArn}:`, err);
    }
  }

  const now = new Date().toISOString();
  await updateSite(result.siteId, {
    customDomain: null,
    customDomainStatus: null,
    customDomainCertArn: null,
    customDomainValidation: null,
    updatedAt: now,
  });

  return json(200, { removed: true });
}

// GET /api/site/custom-domain
export async function handleGetCustomDomainStatus(
  event: LambdaUrlEvent,
): Promise<ApiResponse> {
  const result = await authenticate(event);
  if (isError(result)) return result;

  if (!result.customDomain) {
    return json(200, { domain: null, status: null });
  }

  // If pending, check ACM for updated status
  if (
    result.customDomainStatus === "pending_validation" &&
    result.customDomainCertArn
  ) {
    try {
      const desc = await acm.send(
        new DescribeCertificateCommand({
          CertificateArn: result.customDomainCertArn,
        }),
      );
      const certStatus = desc.Certificate?.Status;

      if (certStatus === "ISSUED") {
        // Certificate validated — activate domain
        await activateCustomDomain(
          result.siteId,
          result.customDomain,
          result.customDomainCertArn,
          result.username,
        );

        return json(200, {
          domain: result.customDomain,
          status: "active",
          validationRecords: result.customDomainValidation,
        });
      }

      if (certStatus === "FAILED") {
        await updateSite(result.siteId, {
          customDomainStatus: "failed",
          updatedAt: new Date().toISOString(),
        });

        return json(200, {
          domain: result.customDomain,
          status: "failed",
          validationRecords: result.customDomainValidation,
        });
      }
    } catch (err) {
      console.error(`Failed to check ACM certificate status for ${result.customDomainCertArn}:`, err);
    }
  }

  return json(200, {
    domain: result.customDomain,
    status: result.customDomainStatus,
    validationRecords: result.customDomainValidation,
  });
}

export async function activateCustomDomain(
  siteId: string,
  domain: string,
  certArn: string,
  username: string,
): Promise<void> {
  const kvsArn = config.sitesKvsArn;

  // Add domain mapping to KVS
  const desc = await kvsClient.send(
    new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }),
  );
  await kvsClient.send(
    new PutKeyCommand({
      KvsARN: kvsArn,
      Key: `domain:${domain}`,
      Value: username,
      IfMatch: desc.ETag ?? "",
    }),
  );

  // Add alternate domain to CloudFront distribution
  await addAlternateDomain(config.sitesDistributionId, domain, certArn);

  // Update site record
  await updateSite(siteId, {
    customDomainStatus: "active",
    updatedAt: new Date().toISOString(),
  });
}

async function addAlternateDomain(
  distributionId: string,
  domain: string,
  certArn: string,
): Promise<void> {
  const getResult = await cfClient.send(
    new GetDistributionConfigCommand({ Id: distributionId }),
  );

  const distConfig = getResult.DistributionConfig;
  if (!distConfig) throw new Error("Distribution config not found");

  const aliases = distConfig.Aliases?.Items ?? [];
  if (aliases.includes(domain)) return; // Already added

  distConfig.Aliases = {
    Quantity: aliases.length + 1,
    Items: [...aliases, domain],
  };

  // Update viewer certificate to use the new custom domain cert
  distConfig.ViewerCertificate = {
    ACMCertificateArn: certArn,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: "TLSv1.2_2021",
  };

  await cfClient.send(
    new UpdateDistributionCommand({
      Id: distributionId,
      DistributionConfig: distConfig,
      IfMatch: getResult.ETag,
    }),
  );
}

async function removeAlternateDomain(
  distributionId: string,
  domain: string,
): Promise<void> {
  const getResult = await cfClient.send(
    new GetDistributionConfigCommand({ Id: distributionId }),
  );

  const distConfig = getResult.DistributionConfig;
  if (!distConfig) throw new Error("Distribution config not found");

  const aliases = distConfig.Aliases?.Items ?? [];
  const filtered = aliases.filter((a) => a !== domain);

  if (filtered.length === aliases.length) return; // Domain wasn't in list

  distConfig.Aliases = {
    Quantity: filtered.length,
    Items: filtered,
  };

  // If no more custom domains, revert to CloudFront default cert
  if (filtered.length === 0 || filtered.every((a) => a.includes("*"))) {
    distConfig.ViewerCertificate = {
      CloudFrontDefaultCertificate: true,
    };
  }

  await cfClient.send(
    new UpdateDistributionCommand({
      Id: distributionId,
      DistributionConfig: distConfig,
      IfMatch: getResult.ETag,
    }),
  );
}
