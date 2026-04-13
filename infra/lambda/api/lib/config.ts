function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  get sitesTable() {
    return env("SITES_TABLE");
  },
  get templatesTable() {
    return env("TEMPLATES_TABLE");
  },
  get reportsTable() {
    return env("REPORTS_TABLE");
  },
  get assetsBucket() {
    return env("ASSETS_BUCKET");
  },
  get sitesBucket() {
    return env("SITES_BUCKET");
  },
  get buildQueueUrl() {
    return env("BUILD_QUEUE_URL");
  },
  get reportsTopicArn() {
    return env("REPORTS_TOPIC_ARN");
  },
  get assetsCdnUrl() {
    return env("ASSETS_CDN_URL");
  },
  get sitesKvsArn() {
    return env("SITES_KVS_ARN");
  },
  get sitesDistributionId() {
    return env("SITES_DISTRIBUTION_ID");
  },
  get adminToken(): string | null {
    return process.env.ADMIN_TOKEN || null;
  },
};
