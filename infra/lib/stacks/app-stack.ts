import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { NagSuppressions } from "cdk-nag";
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

    // --- Messaging ---

    const reportsTopic = new sns.Topic(this, "ReportsTopic", {
      enforceSSL: true,
    });

    const buildDlq = new sqs.Queue(this, "BuildDlq", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    const buildQueue = new sqs.Queue(this, "BuildQueue", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: buildDlq,
      },
    });

    // --- API Lambda ---

    const apiHandler = new NodejsFunction(this, "ApiHandler", {
      entry: path.join(__dirname, "../../lambda/api/index.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        SITES_TABLE: props.sitesTable.tableName,
        TEMPLATES_TABLE: props.templatesTable.tableName,
        REPORTS_TABLE: props.reportsTable.tableName,
        ASSETS_BUCKET: props.assetsBucket.bucketName,
        SITES_BUCKET: props.sitesBucket.bucketName,
        BUILD_QUEUE_URL: buildQueue.queueUrl,
        REPORTS_TOPIC_ARN: reportsTopic.topicArn,
      },
      bundling: { minify: true, sourceMap: true },
    });

    const fnUrl = apiHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
      },
    });

    props.sitesTable.grantReadWriteData(apiHandler);
    props.templatesTable.grantReadWriteData(apiHandler);
    props.reportsTable.grantReadWriteData(apiHandler);
    props.assetsBucket.grantReadWrite(apiHandler);
    props.sitesBucket.grantReadWrite(apiHandler);
    buildQueue.grantSendMessages(apiHandler);
    reportsTopic.grantPublish(apiHandler);

    // --- Build Lambda ---

    const buildHandler = new NodejsFunction(this, "BuildHandler", {
      entry: path.join(__dirname, "../../lambda/build/index.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 1024,
      reservedConcurrentExecutions: 10,
      environment: {
        SITES_TABLE: props.sitesTable.tableName,
        TEMPLATES_TABLE: props.templatesTable.tableName,
        SITES_BUCKET: props.sitesBucket.bucketName,
        ASSETS_BUCKET: props.assetsBucket.bucketName,
      },
      bundling: { minify: true, sourceMap: true },
    });

    buildHandler.addEventSource(
      new SqsEventSource(buildQueue, { batchSize: 1 }),
    );

    props.sitesTable.grantReadWriteData(buildHandler);
    props.templatesTable.grantReadData(buildHandler);
    props.sitesBucket.grantReadWrite(buildHandler);
    props.assetsBucket.grantRead(buildHandler);

    // --- Safe Browsing Lambda ---

    const safeBrowsingHandler = new NodejsFunction(
      this,
      "SafeBrowsingHandler",
      {
        entry: path.join(__dirname, "../../lambda/safe-browsing/index.ts"),
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.minutes(5),
        memorySize: 256,
        environment: {
          SITES_TABLE: props.sitesTable.tableName,
          SITES_BUCKET: props.sitesBucket.bucketName,
          REPORTS_TOPIC_ARN: reportsTopic.topicArn,
        },
        bundling: { minify: true, sourceMap: true },
      },
    );

    props.sitesTable.grantReadWriteData(safeBrowsingHandler);
    props.sitesBucket.grantReadWrite(safeBrowsingHandler);
    reportsTopic.grantPublish(safeBrowsingHandler);

    new events.Rule(this, "SafeBrowsingSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [new targets.LambdaFunction(safeBrowsingHandler)],
    });

    // --- CloudFront API Distribution ---

    const apiDistribution = new cloudfront.Distribution(
      this,
      "ApiDistribution",
      {
        defaultBehavior: {
          origin: new origins.FunctionUrlOrigin(fnUrl),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    );

    // --- Outputs ---

    this.apiUrl = new cdk.CfnOutput(this, "ApiUrl", {
      value: fnUrl.url,
      description: "API Lambda Function URL",
    });

    new cdk.CfnOutput(this, "ApiDistributionUrl", {
      value: `https://${apiDistribution.distributionDomainName}`,
      description: "API CloudFront distribution URL",
    });

    // --- cdk-nag suppressions ---

    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Lambda basic execution role is a standard AWS managed policy required for CloudWatch Logs access",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are generated by CDK grant* methods for DynamoDB and S3 access patterns",
      },
    ]);

    NagSuppressions.addResourceSuppressions(reportsTopic, [
      {
        id: "AwsSolutions-SNS2",
        reason:
          "Abuse report notifications do not contain sensitive data; KMS encryption not required",
      },
    ]);

    NagSuppressions.addResourceSuppressions(apiDistribution, [
      {
        id: "AwsSolutions-CFR1",
        reason:
          "WAF not required for API distribution; rate limiting handled at application level",
      },
      {
        id: "AwsSolutions-CFR2",
        reason:
          "WAF not required for API distribution; rate limiting handled at application level",
      },
      {
        id: "AwsSolutions-CFR3",
        reason:
          "Access logging not enabled for cost optimization; can be enabled for debugging when needed",
      },
      {
        id: "AwsSolutions-CFR4",
        reason:
          "Using default CloudFront domain without custom certificate; TLS 1.2 enforced when custom domain is added",
      },
    ]);
  }
}
