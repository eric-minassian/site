import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../../config/types";
import { AppStack } from "../stacks/app-stack";
import { StatefulStack } from "../stacks/stateful-stack";

export interface AppStageProps extends cdk.StageProps {
  readonly config: EnvironmentConfig;
}

export class AppStage extends cdk.Stage {
  readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);

    const stateful = new StatefulStack(this, "Stateful", {
      config: props.config,
      stackName: `site-${props.config.stageName.toLowerCase()}-stateful`,
    });

    const app = new AppStack(this, "App", {
      config: props.config,
      sitesTable: stateful.sitesTable,
      templatesTable: stateful.templatesTable,
      reportsTable: stateful.reportsTable,
      assetsBucket: stateful.assetsBucket,
      sitesBucket: stateful.sitesBucket,
      stackName: `site-${props.config.stageName.toLowerCase()}-app`,
    });

    app.addDependency(stateful);

    this.apiUrl = app.apiUrl;
  }
}
