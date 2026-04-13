import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { curatedTemplates } from "./templates";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

interface CfnEvent {
  RequestType: "Create" | "Update" | "Delete";
}

export const handler = async (
  event: CfnEvent,
): Promise<{ PhysicalResourceId: string }> => {
  const physicalId = "seed-curated-templates";

  if (event.RequestType === "Delete") {
    return { PhysicalResourceId: physicalId };
  }

  const tableName = env("TEMPLATES_TABLE");
  const now = new Date().toISOString();

  for (const tmpl of curatedTemplates) {
    // Check if a template with this slug already exists
    const existing = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "SlugIndex",
        KeyConditionExpression: "slug = :s",
        ExpressionAttributeValues: { ":s": tmpl.slug },
        Limit: 1,
      }),
    );

    if (existing.Items && existing.Items.length > 0) {
      // Update existing — preserve templateId, usageCount, createdAt
      const item = existing.Items[0] as { templateId: string };
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { templateId: item.templateId },
          UpdateExpression:
            "SET #name = :name, description = :desc, html = :html, css = :css, variables = :vars, isCurated = :curated, updatedAt = :now",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: {
            ":name": tmpl.name,
            ":desc": tmpl.description,
            ":html": tmpl.html,
            ":css": tmpl.css,
            ":vars": tmpl.variables,
            ":curated": true,
            ":now": now,
          },
        }),
      );
      console.log(`Updated curated template: ${tmpl.slug}`);
    } else {
      // Create new
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            templateId: randomUUID(),
            authorSiteId: "system",
            slug: tmpl.slug,
            name: tmpl.name,
            description: tmpl.description,
            html: tmpl.html,
            css: tmpl.css,
            variables: tmpl.variables,
            isCurated: true,
            forkedFromId: null,
            usageCount: 0,
            createdAt: now,
            updatedAt: now,
          },
        }),
      );
      console.log(`Created curated template: ${tmpl.slug}`);
    }
  }

  console.log(`Seeded ${curatedTemplates.length} curated templates`);
  return { PhysicalResourceId: physicalId };
};
