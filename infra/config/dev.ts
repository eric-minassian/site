import type { EnvironmentConfig } from "./types";

export const devConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  stageName: "Dev",
  domainName: "dev.sitename.app",
  codestarConnectionArn:
    "arn:aws:codeconnections:us-east-1:ACCOUNT_ID:connection/PLACEHOLDER",
  githubRepo: "owner/site",
  githubBranch: "main",
  notificationEmail: "dev@sitename.app",
};
