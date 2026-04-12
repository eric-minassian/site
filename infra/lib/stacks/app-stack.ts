import * as cdk from "aws-cdk-lib";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../../config/types";

export interface AppStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly sitesTable: dynamodb.Table;
  readonly templatesTable: dynamodb.Table;
  readonly reportsTable: dynamodb.Table;
  readonly assetsBucket: s3.Bucket;
  readonly sitesBucket: s3.Bucket;
}

export class AppStack extends cdk.Stack {
  readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // Placeholder — Lambda, CloudFront, SQS defined in T3
    this.apiUrl = new cdk.CfnOutput(this, "ApiUrl", {
      value: "https://placeholder.lambda-url.us-east-1.on.aws",
      description: "API Lambda Function URL",
    });
  }
}
