import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../../config/types";

export interface StatefulStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

export interface StatefulResources {
  readonly sitesTable: dynamodb.Table;
  readonly templatesTable: dynamodb.Table;
  readonly reportsTable: dynamodb.Table;
  readonly assetsBucket: s3.Bucket;
  readonly sitesBucket: s3.Bucket;
}

export class StatefulStack extends cdk.Stack implements StatefulResources {
  readonly sitesTable: dynamodb.Table;
  readonly templatesTable: dynamodb.Table;
  readonly reportsTable: dynamodb.Table;
  readonly assetsBucket: s3.Bucket;
  readonly sitesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StatefulStackProps) {
    super(scope, id, {
      ...props,
      terminationProtection: true,
    });

    this.sitesTable = new dynamodb.Table(this, "SitesTable", {
      partitionKey: { name: "siteId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });
    this.sitesTable.addGlobalSecondaryIndex({
      indexName: "UsernameIndex",
      partitionKey: { name: "username", type: dynamodb.AttributeType.STRING },
    });
    this.sitesTable.addGlobalSecondaryIndex({
      indexName: "KeyHashIndex",
      partitionKey: { name: "keyHash", type: dynamodb.AttributeType.STRING },
    });

    this.templatesTable = new dynamodb.Table(this, "TemplatesTable", {
      partitionKey: {
        name: "templateId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });
    this.templatesTable.addGlobalSecondaryIndex({
      indexName: "AuthorSiteIdIndex",
      partitionKey: {
        name: "authorSiteId",
        type: dynamodb.AttributeType.STRING,
      },
    });
    this.templatesTable.addGlobalSecondaryIndex({
      indexName: "SlugIndex",
      partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
    });

    this.reportsTable = new dynamodb.Table(this, "ReportsTable", {
      partitionKey: { name: "reportId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });
    this.reportsTable.addGlobalSecondaryIndex({
      indexName: "SiteIdIndex",
      partitionKey: { name: "siteId", type: dynamodb.AttributeType.STRING },
    });

    this.assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          maxAge: 3600,
        },
      ],
    });

    this.assetsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOAC",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject"],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        resources: [this.assetsBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": cdk.Aws.ACCOUNT_ID,
          },
        },
      }),
    );

    this.sitesBucket = new s3.Bucket(this, "SitesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Allow CloudFront OAC to read site objects (scoped to this account).
    // Uses aws:SourceAccount instead of distribution ARN to avoid cross-stack cycle.
    this.sitesBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOAC",
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject"],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        resources: [this.sitesBucket.arnForObjects("*")],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": cdk.Aws.ACCOUNT_ID,
          },
        },
      }),
    );
  }
}
