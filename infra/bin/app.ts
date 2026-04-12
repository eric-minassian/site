#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { devConfig, prodConfig } from "../config";
import { PipelineStack } from "../lib/stacks/pipeline-stack";

const app = new cdk.App({
  context: {
    "aws:cdk:disable-stack-trace": "true",
  },
});

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

new PipelineStack(app, "SitePlatformPipeline", {
  env: devConfig.env,
  stackName: "site-pipeline",
  devConfig,
  prodConfig,
});

app.synth();
