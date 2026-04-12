import * as cdk from "aws-cdk-lib";
import {
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/types";
import { AppStage } from "./stages/app-stage";

export interface PipelineStackProps extends cdk.StackProps {
  readonly devConfig: EnvironmentConfig;
  readonly prodConfig: EnvironmentConfig;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const source = CodePipelineSource.connection(
      props.devConfig.githubRepo,
      props.devConfig.githubBranch,
      {
        connectionArn: props.devConfig.codestarConnectionArn,
      },
    );

    const pipeline = new CodePipeline(this, "Pipeline", {
      pipelineName: "SitePlatformPipeline",
      selfMutation: true,
      synth: new ShellStep("Synth", {
        input: source,
        commands: [
          "cd infra",
          "pnpm install --frozen-lockfile",
          "pnpm run build",
          "pnpm run test",
          "npx cdk synth",
        ],
        primaryOutputDirectory: "infra/cdk.out",
      }),
    });

    // Dev stage — auto-deploy + smoke test
    const devStage = new AppStage(this, "Dev", {
      env: props.devConfig.env,
      config: props.devConfig,
    });

    const dev = pipeline.addStage(devStage);
    dev.addPost(
      new ShellStep("SmokeTest", {
        commands: ["curl -f $API_URL/health"],
        envFromCfnOutputs: {
          API_URL: devStage.apiUrl,
        },
      }),
    );

    // Prod stage — manual approval gate
    const prodStage = new AppStage(this, "Prod", {
      env: props.prodConfig.env,
      config: props.prodConfig,
    });

    pipeline.addStage(prodStage, {
      pre: [new ManualApprovalStep("PromoteToProd")],
    });
  }
}
