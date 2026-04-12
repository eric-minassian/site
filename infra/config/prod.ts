import type { EnvironmentConfig } from "./types";

export const prodConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  stageName: "Prod",
  codestarConnectionArn:
    "arn:aws:codeconnections:us-east-1:586098609055:connection/957213e2-71ff-4eec-a7ba-0a8a2899f417",
  githubRepo: "eric-minassian/site",
  githubBranch: "main",
};
