import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { devConfig } from "../config";
import { AppStack } from "../lib/stacks/app-stack";
import { StatefulStack } from "../lib/stacks/stateful-stack";

describe("AppStack", () => {
  const app = new cdk.App();

  const stateful = new StatefulStack(app, "TestStateful", {
    config: devConfig,
  });

  const stack = new AppStack(app, "TestApp", {
    config: devConfig,
    sitesTable: stateful.sitesTable,
    templatesTable: stateful.templatesTable,
    reportsTable: stateful.reportsTable,
    assetsBucket: stateful.assetsBucket,
    sitesBucket: stateful.sitesBucket,
  });

  const template = Template.fromStack(stack);

  it("creates Lambda functions (3 app + 2 CDK custom resources)", () => {
    template.resourceCountIs("AWS::Lambda::Function", 5);
  });

  it("creates API Lambda with correct config", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      MemorySize: 512,
      Timeout: 30,
    });
  });

  it("creates Build Lambda", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      MemorySize: 1024,
      Timeout: 120,
    });
  });

  it("creates Safe Browsing Lambda", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      MemorySize: 256,
      Timeout: 300,
    });
  });

  it("creates Function URL for API Lambda", () => {
    template.hasResourceProperties("AWS::Lambda::Url", {
      AuthType: "NONE",
      Cors: {
        AllowHeaders: ["*"],
        AllowMethods: ["*"],
        AllowOrigins: ["*"],
      },
    });
  });

  it("creates SQS build queue with DLQ", () => {
    template.resourceCountIs("AWS::SQS::Queue", 2);
    template.hasResourceProperties("AWS::SQS::Queue", {
      VisibilityTimeout: 300,
      SqsManagedSseEnabled: true,
    });
  });

  it("creates SNS topic for abuse reports", () => {
    template.resourceCountIs("AWS::SNS::Topic", 1);
  });

  it("creates API CloudFront distribution", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: "https-only",
        },
      },
    });
  });

  it("creates 3 CloudFront distributions (API, Sites, Frontend)", () => {
    template.resourceCountIs("AWS::CloudFront::Distribution", 3);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: "redirect-to-https",
        },
      },
    });
  });

  it("creates CloudFront Function for site routing", () => {
    template.resourceCountIs("AWS::CloudFront::Function", 1);
    template.hasResourceProperties("AWS::CloudFront::Function", {
      FunctionConfig: {
        Runtime: "cloudfront-js-2.0",
      },
    });
  });

  it("creates KeyValueStore for site routing data", () => {
    template.resourceCountIs("AWS::CloudFront::KeyValueStore", 1);
  });

  it("creates response headers policy with CSP", () => {
    template.hasResourceProperties(
      "AWS::CloudFront::ResponseHeadersPolicy",
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy:
                "script-src 'none'; frame-ancestors 'none'",
              Override: true,
            },
            FrameOptions: {
              FrameOption: "DENY",
              Override: true,
            },
          },
        },
      },
    );
  });

  it("creates EventBridge rule for daily Safe Browsing scan", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: "rate(1 day)",
    });
  });

  it("exports API URL", () => {
    expect(stack.apiUrl).toBeDefined();
  });

  it("enforces SSL on SQS queues", () => {
    template.resourceCountIs("AWS::SQS::QueuePolicy", 2);
  });

  it("enforces SSL on SNS topic", () => {
    template.resourceCountIs("AWS::SNS::TopicPolicy", 1);
  });

  it("creates frontend S3 bucket with public access blocked", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("creates frontend distribution with SPA error responses", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultRootObject: "index.html",
        CustomErrorResponses: [
          {
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
            ErrorCachingMinTTL: 0,
          },
          {
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
            ErrorCachingMinTTL: 0,
          },
        ],
      },
    });
  });

  it("creates frontend response headers policy with security headers", () => {
    template.hasResourceProperties(
      "AWS::CloudFront::ResponseHeadersPolicy",
      {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            FrameOptions: {
              FrameOption: "DENY",
              Override: true,
            },
            StrictTransportSecurity: {
              AccessControlMaxAgeSec: 31536000,
              IncludeSubdomains: true,
              Override: true,
            },
            ReferrerPolicy: {
              ReferrerPolicy: "strict-origin-when-cross-origin",
              Override: true,
            },
          },
        },
      },
    );
  });
});
