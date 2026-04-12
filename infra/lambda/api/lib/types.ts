export interface LambdaUrlEvent {
  requestContext: {
    http: {
      method: string;
      path: string;
      sourceIp: string;
    };
  };
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded: boolean;
}

export interface ApiResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export interface Site {
  siteId: string;
  username: string;
  keyHash: string;
  title: string;
  markdown: string;
  templateId: string | null;
  templateVariables: Record<string, string>;
  status: "draft" | "building" | "live";
  buildStatus: "idle" | "queued" | "building" | "success" | "failed";
  createdAt: string;
  updatedAt: string;
  lastBuildAt: string | null;
}
