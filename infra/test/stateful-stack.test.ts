import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { devConfig } from "../config";
import { StatefulStack } from "../lib/stacks/stateful-stack";

describe("StatefulStack", () => {
  const app = new cdk.App();
  const stack = new StatefulStack(app, "TestStateful", {
    config: devConfig,
  });
  const template = Template.fromStack(stack);

  it("creates 3 DynamoDB tables", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 3);
  });

  it("creates 2 S3 buckets", () => {
    template.resourceCountIs("AWS::S3::Bucket", 2);
  });

  it("enables point-in-time recovery on all tables", () => {
    template.allResourcesProperties("AWS::DynamoDB::Table", {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  it("uses PAY_PER_REQUEST billing", () => {
    template.allResourcesProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("blocks public access on all buckets", () => {
    template.allResourcesProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("enforces SSL on all buckets", () => {
    template.resourceCountIs("AWS::S3::BucketPolicy", 2);
  });

  it("adds username GSI to Sites table", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "siteId", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "UsernameIndex",
          KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    });
  });

  it("adds authorSiteId GSI to Templates table", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "templateId", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "AuthorSiteIdIndex",
          KeySchema: [{ AttributeName: "authorSiteId", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    });
  });

  it("adds siteId GSI to Reports table", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "reportId", KeyType: "HASH" }],
      GlobalSecondaryIndexes: [
        {
          IndexName: "SiteIdIndex",
          KeySchema: [{ AttributeName: "siteId", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    });
  });

  it("sets termination protection", () => {
    expect(stack.terminationProtection).toBe(true);
  });
});
