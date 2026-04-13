import {
  ACMClient,
  DescribeCertificateCommand,
} from "@aws-sdk/client-acm";
import {
  CloudFrontKeyValueStoreClient,
  DescribeKeyValueStoreCommand,
  PutKeyCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";
import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const acm = new ACMClient({ region: "us-east-1" });
const kvsClient = new CloudFrontKeyValueStoreClient({ region: "us-east-1" });
const cfClient = new CloudFrontClient({ region: "us-east-1" });
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SITES_TABLE = process.env.SITES_TABLE ?? "";
const KVS_ARN = process.env.SITES_KVS_ARN ?? "";
const DISTRIBUTION_ID = process.env.SITES_DISTRIBUTION_ID ?? "";

interface PendingSite {
  siteId: string;
  username: string;
  customDomain: string;
  customDomainCertArn: string;
}

export const handler = async (): Promise<void> => {
  console.log("Domain cert checker started");

  // Scan for sites with pending_validation status
  const pending = await scanPendingSites();
  console.log(`Found ${pending.length} sites with pending domain validation`);

  for (const site of pending) {
    try {
      await checkAndActivate(site);
    } catch (err) {
      console.error(`Error processing site ${site.siteId}:`, err);
    }
  }
};

async function scanPendingSites(): Promise<PendingSite[]> {
  const items: PendingSite[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await doc.send(
      new ScanCommand({
        TableName: SITES_TABLE,
        FilterExpression: "customDomainStatus = :s",
        ExpressionAttributeValues: { ":s": "pending_validation" },
        ProjectionExpression:
          "siteId, username, customDomain, customDomainCertArn",
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items as PendingSite[]) ?? []));
    lastKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastKey);

  return items;
}

async function checkAndActivate(site: PendingSite): Promise<void> {
  const desc = await acm.send(
    new DescribeCertificateCommand({
      CertificateArn: site.customDomainCertArn,
    }),
  );

  const certStatus = desc.Certificate?.Status;
  console.log(
    `Site ${site.siteId} (${site.customDomain}): cert status = ${certStatus}`,
  );

  if (certStatus === "ISSUED") {
    // Add domain mapping to KVS
    const kvsDesc = await kvsClient.send(
      new DescribeKeyValueStoreCommand({ KvsARN: KVS_ARN }),
    );
    await kvsClient.send(
      new PutKeyCommand({
        KvsARN: KVS_ARN,
        Key: `domain:${site.customDomain}`,
        Value: site.username,
        IfMatch: kvsDesc.ETag ?? "",
      }),
    );

    // Add alternate domain to CloudFront distribution
    await addAlternateDomain(
      DISTRIBUTION_ID,
      site.customDomain,
      site.customDomainCertArn,
    );

    // Update site record
    await doc.send(
      new UpdateCommand({
        TableName: SITES_TABLE,
        Key: { siteId: site.siteId },
        UpdateExpression:
          "SET customDomainStatus = :s, updatedAt = :u",
        ExpressionAttributeValues: {
          ":s": "active",
          ":u": new Date().toISOString(),
        },
      }),
    );

    console.log(
      `Activated custom domain ${site.customDomain} for site ${site.siteId}`,
    );
  } else if (certStatus === "FAILED") {
    await doc.send(
      new UpdateCommand({
        TableName: SITES_TABLE,
        Key: { siteId: site.siteId },
        UpdateExpression:
          "SET customDomainStatus = :s, updatedAt = :u",
        ExpressionAttributeValues: {
          ":s": "failed",
          ":u": new Date().toISOString(),
        },
      }),
    );

    console.log(
      `Domain validation failed for ${site.customDomain} (site ${site.siteId})`,
    );
  }
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
  if (aliases.includes(domain)) return;

  distConfig.Aliases = {
    Quantity: aliases.length + 1,
    Items: [...aliases, domain],
  };

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
