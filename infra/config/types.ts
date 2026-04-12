import type { Environment } from "aws-cdk-lib";

export interface EnvironmentConfig {
  readonly env: Environment;
  readonly stageName: string;
  readonly codestarConnectionArn: string;
  readonly githubRepo: string;
  readonly githubBranch: string;
  /** Domain for user sites, e.g. "sitename.app" — enables *.sitename.app routing */
  readonly sitesDomainName?: string;
  /** ACM certificate ARN for *.sitesDomainName (must be in us-east-1) */
  readonly sitesCertificateArn?: string;
}
