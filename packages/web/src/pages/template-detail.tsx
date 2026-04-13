import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Calendar,
  Copy,
  Download,
  GitFork,
  Loader2,
  Palette,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LivePreview } from "@/components/live-preview";
import { useAuth } from "@/contexts/auth-context";
import {
  forkTemplate,
  getTemplateBySlug,
  updateSite,
  type TemplateDetail,
  type TemplateVariable,
} from "@/lib/api";

const SAMPLE_MARKDOWN = `# Welcome to My Site

This is a **preview** of the template with sample content.

## About

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Features

- Clean and responsive design
- Easy to customize
- Fast loading

## Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci

---

*Built with love.*
`;

const FONT_OPTIONS = [
  { value: "system-ui, sans-serif", label: "System Default" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  { value: "Palatino, serif", label: "Palatino" },
  { value: "Garamond, serif", label: "Garamond" },
  { value: "'Segoe UI', sans-serif", label: "Segoe UI" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "'Lucida Console', monospace", label: "Lucida Console" },
];

function combineTemplateCss(html: string, css: string): string {
  if (!css) return html;
  const styleTag = `<style>${css}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function VariablePreviewControl({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  const current = value || variable.default;

  switch (variable.type) {
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input"
          />
          <Input
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>
      );
    case "font":
      return (
        <Select value={current} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((font) => (
              <SelectItem
                key={font.value}
                value={font.value}
                className="text-xs"
              >
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "number":
      return (
        <Input
          type="number"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );
    case "select":
      return (
        <Select value={current} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(variable.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "text":
    default:
      return (
        <Input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={variable.default}
        />
      );
  }
}

export default function TemplateDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  // Fork dialog
  const [forkOpen, setForkOpen] = useState(false);
  const [forkSlug, setForkSlug] = useState("");
  const [forkName, setForkName] = useState("");
  const [forking, setForking] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await getTemplateBySlug(slug!);
        if (cancelled) return;
        setTemplate(detail);

        const defaults: Record<string, string> = {};
        for (const v of detail.variables) {
          defaults[v.name] = v.default;
        }
        setVariables(defaults);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load template",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
  }, []);

  const previewTemplate = useMemo(() => {
    if (!template) return undefined;
    return combineTemplateCss(template.html, template.css);
  }, [template]);

  const handleUseTemplate = useCallback(async () => {
    if (!token || !template) return;
    setApplying(true);
    try {
      await updateSite(token, {
        templateId: template.templateId,
        templateVariables: variables,
      });
      toast.success("Template applied to your site");
      navigate("/builder");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply template",
      );
    } finally {
      setApplying(false);
    }
  }, [token, template, variables, navigate]);

  const handleFork = useCallback(async () => {
    if (!token || !template) return;
    setForking(true);
    try {
      const forked = await forkTemplate(token, template.templateId, {
        slug: forkSlug,
        name: forkName || undefined,
      });
      toast.success("Template forked successfully");
      setForkOpen(false);
      navigate(`/templates/${forked.slug}/edit`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fork template",
      );
    } finally {
      setForking(false);
    }
  }, [token, template, forkSlug, forkName, navigate]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error ?? "Template not found"}</p>
        <Button variant="outline" asChild>
          <Link to="/marketplace">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Marketplace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/marketplace">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Marketplace
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{template.name}</h1>
            {template.isCurated && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Curated
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{template.description}</p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {template.authorSiteId}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {template.usageCount} {template.usageCount === 1 ? "use" : "uses"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(template.createdAt)}
            </span>
            {template.forkedFromId && (
              <span className="flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                Forked
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {isAuthenticated && (
            <>
              <Button onClick={handleUseTemplate} disabled={applying}>
                {applying ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Palette className="mr-1.5 h-4 w-4" />
                )}
                Use Template
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setForkSlug(`${template.slug}-fork`);
                  setForkName(`${template.name} (fork)`);
                  setForkOpen(true);
                }}
              >
                <GitFork className="mr-1.5 h-4 w-4" />
                Fork
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main content: preview + controls */}
      <div className="grid min-h-[500px] gap-6 lg:grid-cols-[1fr_300px]">
        {/* Preview */}
        <div className="min-h-0">
          <LivePreview
            markdown={SAMPLE_MARKDOWN}
            template={previewTemplate}
            variables={variables}
          />
        </div>

        {/* Sidebar: variable controls */}
        <div className="space-y-4">
          {template.variables.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h3 className="text-sm font-medium">Customize</h3>
                {template.variables.map((v) => (
                  <div key={v.name}>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {v.label}
                    </label>
                    <VariablePreviewControl
                      variable={v}
                      value={variables[v.name] ?? ""}
                      onChange={(val) => handleVariableChange(v.name, val)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Template info card */}
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <h3 className="font-medium">Details</h3>
              <div className="flex justify-between text-muted-foreground">
                <span>Variables</span>
                <span>{template.variables.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Updated</span>
                <span>{formatDate(template.updatedAt)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Slug</span>
                <span className="font-mono text-xs">{template.slug}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Code tabs */}
      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="css">CSS</TabsTrigger>
        </TabsList>
        <TabsContent value="html">
          <CodeBlock code={template.html} />
        </TabsContent>
        <TabsContent value="css">
          <CodeBlock code={template.css || "(no custom CSS)"} />
        </TabsContent>
      </Tabs>

      {/* Fork dialog */}
      <Dialog open={forkOpen} onOpenChange={setForkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork Template</DialogTitle>
            <DialogDescription>
              Create your own copy of &ldquo;{template.name}&rdquo; to
              customize.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <Input
                value={forkSlug}
                onChange={(e) => setForkSlug(e.target.value)}
                placeholder="my-template-fork"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL-safe identifier (lowercase, hyphens allowed)
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Name (optional)
              </label>
              <Input
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                placeholder={`${template.name} (fork)`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFork}
              disabled={forking || !forkSlug.trim()}
            >
              {forking && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Fork Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8"
        onClick={handleCopy}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/50 p-4 text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}
