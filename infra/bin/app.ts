#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { devConfig, prodConfig } from "../config";
import { PipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

new PipelineStack(app, "SitePlatformPipeline", {
  env: devConfig.env,
  stackName: "site-pipeline",
  devConfig,
  prodConfig,
});

app.synth();
