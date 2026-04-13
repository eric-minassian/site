import type { Environment } from "aws-cdk-lib";

export interface EnvironmentConfig {
  readonly env: Environment;
  readonly stageName: string;
  readonly codestarConnectionArn: string;
  readonly githubRepo: string;
  readonly githubBranch: string;
  /** Admin token for abuse management endpoints */
  readonly adminToken?: string;
  /** Google Safe Browsing API key for daily site scanning */
  readonly safeBrowsingApiKey?: string;
  /** Domain for user sites, e.g. "sitename.app" — enables *.sitename.app routing */
  readonly sitesDomainName?: string;
  /** ACM certificate ARN for *.sitesDomainName (must be in us-east-1) */
  readonly sitesCertificateArn?: string;
  /** Domain for management UI, e.g. "app.sitename.dev" */
  readonly frontendDomainName?: string;
  /** ACM certificate ARN for frontendDomainName (must be in us-east-1) */
  readonly frontendCertificateArn?: string;
}
