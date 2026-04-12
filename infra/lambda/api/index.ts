import { error, json } from "./lib/response";
import type { ApiResponse, LambdaUrlEvent } from "./lib/types";
import {
  handleCreateSite,
  handleDeleteSite,
  handleGetSite,
  handlePublishSite,
  handleRegeneratePassphrase,
  handleUpdateSite,
} from "./routes/sites";

type Handler = (event: LambdaUrlEvent) => Promise<ApiResponse>;

const routes: Array<{ method: string; path: string; handler: Handler }> = [
  { method: "POST", path: "/api/sites", handler: handleCreateSite },
  { method: "GET", path: "/api/site", handler: handleGetSite },
  { method: "PUT", path: "/api/site", handler: handleUpdateSite },
  { method: "DELETE", path: "/api/site", handler: handleDeleteSite },
  { method: "POST", path: "/api/site/publish", handler: handlePublishSite },
  {
    method: "POST",
    path: "/api/site/regenerate-passphrase",
    handler: handleRegeneratePassphrase,
  },
];

export const handler = async (
  event: LambdaUrlEvent,
): Promise<ApiResponse> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  if (method === "OPTIONS") {
    return json(204, null);
  }

  const route = routes.find((r) => r.method === method && r.path === path);
  if (!route) {
    return error(404, "Not found");
  }

  try {
    return await route.handler(event);
  } catch (err) {
    console.error("Unhandled error:", err);
    return error(500, "Internal server error");
  }
};
