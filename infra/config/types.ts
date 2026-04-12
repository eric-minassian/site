import type { Environment } from "aws-cdk-lib";

export interface EnvironmentConfig {
  readonly env: Environment;
  readonly stageName: string;
  readonly codestarConnectionArn: string;
  readonly githubRepo: string;
  readonly githubBranch: string;
}
