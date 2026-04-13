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
  customDomain: string | null;
  customDomainStatus: "pending_validation" | "active" | "failed" | null;
  customDomainCertArn: string | null;
  customDomainValidation: Array<{ name: string; value: string }> | null;
  createdAt: string;
  updatedAt: string;
  lastBuildAt: string | null;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: "color" | "font" | "number" | "select" | "text";
  default: string;
  options?: string[];
}

export interface Template {
  templateId: string;
  authorSiteId: string;
  slug: string;
  name: string;
  description: string;
  html: string;
  css: string;
  variables: TemplateVariable[];
  isCurated: boolean;
  forkedFromId: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}
