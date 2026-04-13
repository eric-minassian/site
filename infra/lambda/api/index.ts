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
import {
  handleAddCustomDomain,
  handleGetCustomDomainStatus,
  handleRemoveCustomDomain,
} from "./routes/domains";
import { handleRequestUpload } from "./routes/images";
import {
  handleCreateTemplate,
  handleDeleteTemplate,
  handleForkTemplate,
  handleGetTemplate,
  handleListTemplates,
  handleUpdateTemplate,
} from "./routes/templates";

type Handler = (
  event: LambdaUrlEvent,
  params: Record<string, string>,
) => Promise<ApiResponse>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

function buildRoute(method: string, path: string, handler: Handler): Route {
  return { method, segments: path.split("/"), handler };
}

function matchRoute(
  route: Route,
  method: string,
  path: string,
): Record<string, string> | null {
  if (route.method !== method) return null;
  const pathSegments = path.split("/");
  if (route.segments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i];
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = pathSegments[i];
    } else if (seg !== pathSegments[i]) {
      return null;
    }
  }
  return params;
}

const routes: Route[] = [
  // Site routes
  buildRoute("POST", "/api/sites", handleCreateSite),
  buildRoute("GET", "/api/site", handleGetSite),
  buildRoute("PUT", "/api/site", handleUpdateSite),
  buildRoute("DELETE", "/api/site", handleDeleteSite),
  buildRoute("POST", "/api/site/publish", handlePublishSite),
  buildRoute(
    "POST",
    "/api/site/regenerate-passphrase",
    handleRegeneratePassphrase,
  ),

  // Custom domain routes
  buildRoute("POST", "/api/site/custom-domain", handleAddCustomDomain),
  buildRoute("GET", "/api/site/custom-domain", handleGetCustomDomainStatus),
  buildRoute("DELETE", "/api/site/custom-domain", handleRemoveCustomDomain),

  // Image routes
  buildRoute("POST", "/api/images", handleRequestUpload),

  // Template routes (order matters: specific patterns before parameterized)
  buildRoute("GET", "/api/templates", handleListTemplates),
  buildRoute("POST", "/api/templates", handleCreateTemplate),
  buildRoute("POST", "/api/templates/:id/fork", handleForkTemplate),
  buildRoute("GET", "/api/templates/:slug", handleGetTemplate),
  buildRoute("PUT", "/api/templates/:id", handleUpdateTemplate),
  buildRoute("DELETE", "/api/templates/:id", handleDeleteTemplate),
];

export const handler = async (
  event: LambdaUrlEvent,
): Promise<ApiResponse> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  if (method === "OPTIONS") {
    return json(204, null);
  }

  for (const route of routes) {
    const params = matchRoute(route, method, path);
    if (params) {
      try {
        return await route.handler(event, params);
      } catch (err) {
        console.error("Unhandled error:", err);
        return error(500, "Internal server error");
      }
    }
  }

  return error(404, "Not found");
};
