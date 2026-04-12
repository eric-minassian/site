import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { devConfig, prodConfig } from "../config";
import { PipelineStack } from "../lib/stacks/pipeline-stack";

describe("PipelineStack", () => {
  const app = new cdk.App();
  const stack = new PipelineStack(app, "TestPipeline", {
    env: devConfig.env,
    devConfig,
    prodConfig,
  });
  const template = Template.fromStack(stack);

  it("creates a CodePipeline", () => {
    template.resourceCountIs("AWS::CodePipeline::Pipeline", 1);
  });
});
