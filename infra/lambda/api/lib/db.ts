import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "./config";
import type { Site, Template } from "./types";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

export async function getSiteById(siteId: string): Promise<Site | null> {
  const result = await doc.send(
    new GetCommand({
      TableName: config.sitesTable,
      Key: { siteId },
    }),
  );
  return (result.Item as Site | undefined) ?? null;
}

export async function getSiteByUsername(
  username: string,
): Promise<Site | null> {
  const result = await doc.send(
    new QueryCommand({
      TableName: config.sitesTable,
      IndexName: "UsernameIndex",
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": username },
      Limit: 1,
    }),
  );
  return (result.Items?.[0] as Site | undefined) ?? null;
}

export async function getSiteByKeyHash(
  keyHash: string,
): Promise<Site | null> {
  const result = await doc.send(
    new QueryCommand({
      TableName: config.sitesTable,
      IndexName: "KeyHashIndex",
      KeyConditionExpression: "keyHash = :k",
      ExpressionAttributeValues: { ":k": keyHash },
      Limit: 1,
    }),
  );
  return (result.Items?.[0] as Site | undefined) ?? null;
}

export async function createSite(site: Site): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: config.sitesTable,
      Item: site,
      ConditionExpression: "attribute_not_exists(siteId)",
    }),
  );
}

export async function updateSite(
  siteId: string,
  updates: Record<string, unknown>,
): Promise<Site | null> {
  const entries = Object.entries(updates).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return null;

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const exprs: string[] = [];

  for (const [key, value] of entries) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    exprs.push(`#${key} = :${key}`);
  }

  const result = await doc.send(
    new UpdateCommand({
      TableName: config.sitesTable,
      Key: { siteId },
      UpdateExpression: `SET ${exprs.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(siteId)",
      ReturnValues: "ALL_NEW",
    }),
  );
  return (result.Attributes as Site | undefined) ?? null;
}

export async function deleteSite(siteId: string): Promise<void> {
  await doc.send(
    new DeleteCommand({
      TableName: config.sitesTable,
      Key: { siteId },
    }),
  );
}

export async function getTemplatesByAuthor(
  authorSiteId: string,
): Promise<Array<{ templateId: string }>> {
  const result = await doc.send(
    new QueryCommand({
      TableName: config.templatesTable,
      IndexName: "AuthorSiteIdIndex",
      KeyConditionExpression: "authorSiteId = :a",
      ExpressionAttributeValues: { ":a": authorSiteId },
      ProjectionExpression: "templateId",
    }),
  );
  return (result.Items as Array<{ templateId: string }>) ?? [];
}

export async function getTemplateById(
  templateId: string,
): Promise<Template | null> {
  const result = await doc.send(
    new GetCommand({
      TableName: config.templatesTable,
      Key: { templateId },
    }),
  );
  return (result.Item as Template | undefined) ?? null;
}

export async function getTemplateBySlug(
  slug: string,
): Promise<Template | null> {
  const result = await doc.send(
    new QueryCommand({
      TableName: config.templatesTable,
      IndexName: "SlugIndex",
      KeyConditionExpression: "slug = :s",
      ExpressionAttributeValues: { ":s": slug },
      Limit: 1,
    }),
  );
  return (result.Items?.[0] as Template | undefined) ?? null;
}

export async function createTemplate(template: Template): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: config.templatesTable,
      Item: template,
      ConditionExpression: "attribute_not_exists(templateId)",
    }),
  );
}

export async function updateTemplate(
  templateId: string,
  updates: Record<string, unknown>,
): Promise<Template | null> {
  const entries = Object.entries(updates).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return null;

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const exprs: string[] = [];

  for (const [key, value] of entries) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    exprs.push(`#${key} = :${key}`);
  }

  const result = await doc.send(
    new UpdateCommand({
      TableName: config.templatesTable,
      Key: { templateId },
      UpdateExpression: `SET ${exprs.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(templateId)",
      ReturnValues: "ALL_NEW",
    }),
  );
  return (result.Attributes as Template | undefined) ?? null;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await doc.send(
    new DeleteCommand({
      TableName: config.templatesTable,
      Key: { templateId },
    }),
  );
}

export async function scanAllTemplates(): Promise<Template[]> {
  const items: Template[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await doc.send(
      new ScanCommand({
        TableName: config.templatesTable,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items as Template[]) ?? []));
    lastKey = result.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (lastKey);

  return items;
}

export async function getTemplatesByAuthorFull(
  authorSiteId: string,
): Promise<Template[]> {
  const result = await doc.send(
    new QueryCommand({
      TableName: config.templatesTable,
      IndexName: "AuthorSiteIdIndex",
      KeyConditionExpression: "authorSiteId = :a",
      ExpressionAttributeValues: { ":a": authorSiteId },
    }),
  );
  return (result.Items as Template[]) ?? [];
}
