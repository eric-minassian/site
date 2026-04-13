import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  GitFork,
  Save,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import {
  getTemplateBySlug,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../lib/api";
import type { TemplateVariable } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CodeEditor } from "../components/code-editor";
import { VariableDefinitionEditor } from "../components/variable-definition-editor";
import { LivePreview } from "../components/live-preview";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const MIN_PANE_PERCENT = 20;
const MAX_PANE_PERCENT = 80;

const SAMPLE_MARKDOWN = `---
title: My Site
---

# Welcome to My Site

This is a **sample page** to preview your template.

## About

Some introductory text with a [link](https://example.com).

- Item one
- Item two
- Item three

> A blockquote for style testing.

\`\`\`js
function hello() {
  console.log("Hello, world!");
}
\`\`\`

## Contact

Feel free to reach out!
`;

function combineTemplateCss(html: string, css: string): string {
  if (!css) return html;
  const styleTag = `<style>${css}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}

export default function TemplateEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const isNew = !slug;

  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Template fields
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState("");
  const [description, setDescription] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [forkedFromId, setForkedFromId] = useState<string | null>(null);
  const [forkedFromName, setForkedFromName] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leftTab, setLeftTab] = useState("html");

  // Preview variables (live values based on variable definitions)
  const previewVariables = useMemo(() => {
    const vals: Record<string, string> = {};
    for (const v of variables) {
      vals[v.name] = v.default;
    }
    return vals;
  }, [variables]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    if (isNew) return;

    let cancelled = false;
    async function load() {
      try {
        const template = await getTemplateBySlug(slug!);
        if (cancelled) return;
        setTemplateId(template.templateId);
        setName(template.name);
        setTemplateSlug(template.slug);
        setDescription(template.description);
        setHtmlContent(template.html);
        setCssContent(template.css);
        setVariables(template.variables);
        setForkedFromId(template.forkedFromId);

        // Resolve forked-from name
        if (template.forkedFromId) {
          try {
            const allTemplates = await getTemplates({ limit: 50 });
            const parent = allTemplates.items.find(
              (t) => t.templateId === template.forkedFromId,
            );
            if (parent && !cancelled) setForkedFromName(parent.name);
          } catch {
            // Not critical
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load template",
          );
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, isNew, token, isAuthenticated, navigate]);

  const showSaved = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;

    // Validation
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!templateSlug.trim()) {
      setSaveError("Slug is required");
      return;
    }
    if (!htmlContent.trim()) {
      setSaveError("HTML is required");
      return;
    }

    // Filter out incomplete variables
    const validVars = variables.filter((v) => v.name.trim() && v.label.trim());

    setSaveStatus("saving");
    setSaveError(null);

    try {
      if (isNew) {
        const created = await createTemplate(token, {
          slug: templateSlug.trim(),
          name: name.trim(),
          description: description.trim(),
          html: htmlContent,
          css: cssContent,
          variables: validVars,
        });
        setTemplateId(created.templateId);
        showSaved();
        // Navigate to edit URL so future saves update instead of create
        navigate(`/templates/${created.slug}/edit`, { replace: true });
      } else {
        await updateTemplate(token, templateId!, {
          slug: templateSlug.trim(),
          name: name.trim(),
          description: description.trim(),
          html: htmlContent,
          css: cssContent,
          variables: validVars,
        });
        showSaved();
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  }, [
    token,
    name,
    templateSlug,
    description,
    htmlContent,
    cssContent,
    variables,
    isNew,
    templateId,
    showSaved,
    navigate,
  ]);

  const handleDelete = useCallback(async () => {
    if (!token || !templateId) return;
    setSaveStatus("saving");
    try {
      await deleteTemplate(token, templateId);
      navigate("/marketplace", { replace: true });
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [token, templateId, navigate]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setDragging(true);

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(
        Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, percent)),
      );
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const previewTemplate = useMemo(
    () => combineTemplateCss(htmlContent, cssContent),
    [htmlContent, cssContent],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="h-8 w-48 text-sm font-medium"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">/</span>
            <Input
              value={templateSlug}
              onChange={(e) =>
                setTemplateSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              placeholder="slug"
              className="h-8 w-40 font-mono text-xs"
            />
          </div>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="hidden h-8 min-w-0 flex-1 text-xs lg:block"
          />
        </div>

        <div className="flex items-center gap-2">
          {forkedFromId && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitFork className="h-3.5 w-3.5" />
              Forked{forkedFromName ? ` from ${forkedFromName}` : ""}
            </span>
          )}
          <SaveIndicator status={saveStatus} />
          {saveError && (
            <span className="text-xs text-destructive">{saveError}</span>
          )}
          {!isNew && templateId && (
            <>
              {deleteConfirm ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-destructive">Delete?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleDelete}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteConfirm(true)}
                  title="Delete template"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button size="sm" className="h-8" onClick={handleSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isNew ? "Publish" : "Update"}
          </Button>
        </div>
      </div>

      {/* Main split pane */}
      <div ref={containerRef} className="relative flex min-h-0 flex-1">
        {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}

        {/* Left pane: code editors + variables */}
        <div
          className="flex min-w-0 flex-col"
          style={{ width: `${splitPercent}%` }}
        >
          <Tabs
            value={leftTab}
            onValueChange={setLeftTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-4 mt-2 w-fit">
              <TabsTrigger value="html" className="text-xs">
                HTML
              </TabsTrigger>
              <TabsTrigger value="css" className="text-xs">
                CSS
              </TabsTrigger>
              <TabsTrigger value="variables" className="text-xs">
                Variables ({variables.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-0 flex min-h-0 flex-1 flex-col p-4 pt-2">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                <CodeEditor
                  key="html"
                  initialValue={htmlContent}
                  language="html"
                  onChange={setHtmlContent}
                  placeholder="Enter your template HTML with Handlebars syntax... Use {{{content}}} for rendered markdown."
                />
              </div>
            </TabsContent>

            <TabsContent value="css" className="mt-0 flex min-h-0 flex-1 flex-col p-4 pt-2">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                <CodeEditor
                  key="css"
                  initialValue={cssContent}
                  language="css"
                  onChange={setCssContent}
                  placeholder="Enter your template CSS..."
                />
              </div>
            </TabsContent>

            <TabsContent value="variables" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4 pt-2">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Define variables that users can customize. Use{" "}
                  <code className="rounded bg-muted px-1">{"{{variableName}}"}</code>{" "}
                  in your HTML/CSS to reference them.
                </p>
                <VariableDefinitionEditor
                  variables={variables}
                  onChange={setVariables}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Drag handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/20 active:bg-primary/30"
          onMouseDown={handleDragStart}
        />

        {/* Right pane: live preview */}
        <div
          className="min-w-0 p-4"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <LivePreview
            markdown={SAMPLE_MARKDOWN}
            template={previewTemplate || undefined}
            variables={previewVariables}
          />
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving...
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle className="h-3.5 w-3.5" />
          Saved
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Error
        </span>
      );
    default:
      return null;
  }
}
