import * as fs from "node:fs";
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
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

    // --- CloudFront Sites Distribution ---

    const sitesKvs = new cloudfront.KeyValueStore(this, "SitesKvs", {
      comment: "Routing data for user sites (suspension list and custom domain mappings)",
    });

    const routerFunctionCode = fs.readFileSync(
      path.join(__dirname, "../cf-functions/router.js"),
      "utf-8",
    );

    const routerFunction = new cloudfront.Function(this, "SitesRouterFunction", {
      code: cloudfront.FunctionCode.fromInline(routerFunctionCode),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      keyValueStore: sitesKvs,
      comment: "Routes requests by subdomain/custom domain to S3 site paths",
    });

    const sitesResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "SitesResponseHeadersPolicy",
      {
        comment: "Security headers for user-generated sites",
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: "script-src 'none'; frame-ancestors 'none'",
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            override: true,
          },
        },
      },
    );

    const sitesCachePolicy = new cloudfront.CachePolicy(
      this,
      "SitesCachePolicy",
      {
        comment: "24h default TTL for user sites",
        defaultTtl: cdk.Duration.hours(24),
        minTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.days(365),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    const sitesDistributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          s3.Bucket.fromBucketName(
            this,
            "SitesBucketRef",
            props.sitesBucket.bucketName,
          ),
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: sitesCachePolicy,
        responseHeadersPolicy: sitesResponseHeadersPolicy,
        functionAssociations: [
          {
            function: routerFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      ...(props.config.sitesDomainName && props.config.sitesCertificateArn
        ? {
            domainNames: [`*.${props.config.sitesDomainName}`],
            certificate: acm.Certificate.fromCertificateArn(
              this,
              "SitesCert",
              props.config.sitesCertificateArn,
            ),
          }
        : {}),
    };

    const sitesDistribution = new cloudfront.Distribution(
      this,
      "SitesDistribution",
      sitesDistributionProps,
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

    new cdk.CfnOutput(this, "SitesDistributionUrl", {
      value: `https://${sitesDistribution.distributionDomainName}`,
      description: "Sites CloudFront distribution URL",
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

    NagSuppressions.addResourceSuppressions(sitesDistribution, [
      {
        id: "AwsSolutions-CFR1",
        reason:
          "WAF not required for sites distribution; static content only with CSP script-src 'none'",
      },
      {
        id: "AwsSolutions-CFR2",
        reason:
          "WAF not required for sites distribution; static content only with CSP script-src 'none'",
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
