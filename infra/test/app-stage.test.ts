import * as cdk from "aws-cdk-lib";
import { describe, expect, it } from "vitest";
import { devConfig } from "../config";
import { AppStage } from "../lib/stages/app-stage";

describe("AppStage", () => {
  const app = new cdk.App();
  const stage = new AppStage(app, "TestStage", {
    config: devConfig,
  });
  const stacks = stage.node.children.filter(
    (child): child is cdk.Stack => child instanceof cdk.Stack,
  );

  it("creates StatefulStack and AppStack", () => {
    const stackNames = stacks.map((s) => s.node.id);
    expect(stackNames).toContain("Stateful");
    expect(stackNames).toContain("App");
  });

  it("exposes apiUrl output", () => {
    expect(stage.apiUrl).toBeDefined();
  });
});
