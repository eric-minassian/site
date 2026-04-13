import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  CloudFrontKeyValueStoreClient,
  DescribeKeyValueStoreCommand,
  PutKeyCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";

interface Site {
  siteId: string;
  username: string;
  status: string;
  suspended?: boolean;
  customDomain?: string | null;
}

interface ThreatMatch {
  threatType: string;
  platformType: string;
  threat: { url: string };
  cacheDuration: string;
}

interface SafeBrowsingResponse {
  matches?: ThreatMatch[];
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});
const kvsClient = new CloudFrontKeyValueStoreClient({ region: "us-east-1" });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  return process.env[name] || null;
}

export const handler = async (): Promise<void> => {
  const sitesTable = env("SITES_TABLE");
  const reportsTopicArn = env("REPORTS_TOPIC_ARN");
  const sitesDomain = optionalEnv("SITES_DOMAIN");
  const apiKey = optionalEnv("SAFE_BROWSING_API_KEY");
  const kvsArn = optionalEnv("SITES_KVS_ARN");

  if (!apiKey) {
    console.log("SAFE_BROWSING_API_KEY not configured, skipping scan");
    return;
  }

  if (!sitesDomain) {
    console.log("SITES_DOMAIN not configured, skipping scan");
    return;
  }

  // Scan all live, non-suspended sites
  const sites = await scanLiveSites(sitesTable);
  console.log(`Found ${sites.length} live sites to check`);

  if (sites.length === 0) return;

  // Build URLs to check
  const urlToSite = new Map<string, Site>();
  for (const site of sites) {
    const url = `https://${site.username}.${sitesDomain}/`;
    urlToSite.set(url, site);
    if (site.customDomain) {
      urlToSite.set(`https://${site.customDomain}/`, site);
    }
  }

  // Check URLs in batches of 500 (API limit)
  const allUrls = [...urlToSite.keys()];
  const flaggedSiteIds = new Set<string>();

  for (let i = 0; i < allUrls.length; i += 500) {
    const batch = allUrls.slice(i, i + 500);
    const matches = await checkSafeBrowsing(apiKey, batch);

    for (const match of matches) {
      const site = urlToSite.get(match.threat.url);
      if (site) {
        flaggedSiteIds.add(site.siteId);
        console.log(
          `FLAGGED: ${site.username} (${match.threatType}) — ${match.threat.url}`,
        );
      }
    }
  }

  if (flaggedSiteIds.size === 0) {
    console.log("No threats found");
    return;
  }

  console.log(`Suspending ${flaggedSiteIds.size} flagged site(s)`);

  // Auto-suspend flagged sites
  for (const siteId of flaggedSiteIds) {
    const site = sites.find((s) => s.siteId === siteId);
    if (!site) continue;

    // Set suspended flag in DB
    await ddb.send(
      new UpdateCommand({
        TableName: sitesTable,
        Key: { siteId },
        UpdateExpression: "SET suspended = :t, updatedAt = :now",
        ExpressionAttributeValues: {
          ":t": true,
          ":now": new Date().toISOString(),
        },
      }),
    );

    // Add to KVS suspension list
    if (kvsArn) {
      try {
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
      } catch (err) {
        console.error(`Failed to update KVS for ${site.username}:`, err);
      }
    }

    // Send SNS notification
    await sns.send(
      new PublishCommand({
        TopicArn: reportsTopicArn,
        Subject: `Auto-suspended: ${site.username} (Safe Browsing)`,
        Message: JSON.stringify({
          action: "auto_suspend",
          siteId: site.siteId,
          username: site.username,
          reason: "Google Safe Browsing flagged this site",
          timestamp: new Date().toISOString(),
        }),
      }),
    );
  }

  console.log(`Done. Suspended ${flaggedSiteIds.size} site(s).`);
};

async function scanLiveSites(tableName: string): Promise<Site[]> {
  const items: Site[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          "#status = :live AND (attribute_not_exists(suspended) OR suspended = :false)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":live": "live", ":false": false },
        ProjectionExpression:
          "siteId, username, #status, suspended, customDomain",
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items as Site[]) ?? []));
    lastKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastKey);

  return items;
}

async function checkSafeBrowsing(
  apiKey: string,
  urls: string[],
): Promise<ThreatMatch[]> {
  const body = JSON.stringify({
    client: { clientId: "site-platform", clientVersion: "1.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION",
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: urls.map((url) => ({ url })),
    },
  });

  const response = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
  );

  if (!response.ok) {
    console.error(
      `Safe Browsing API error: ${response.status} ${response.statusText}`,
    );
    return [];
  }

  const data = (await response.json()) as SafeBrowsingResponse;
  return data.matches ?? [];
}
