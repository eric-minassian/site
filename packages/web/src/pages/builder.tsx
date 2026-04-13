import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import {
  getSite,
  updateSite,
  uploadImage,
  getTemplates,
  getTemplateBySlug,
} from "../lib/api";
import type { TemplateSummary, TemplateDetail } from "../lib/api";
import { MarkdownEditor } from "../components/markdown-editor";
import { LivePreview } from "../components/live-preview";
import { TemplateControls } from "../components/template-controls";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTO_SAVE_DELAY = 1000;
const MIN_PANE_PERCENT = 20;
const MAX_PANE_PERCENT = 80;

function combineTemplateCss(html: string, css: string): string {
  if (!css) return html;
  const styleTag = `<style>${css}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}

export default function BuilderPage() {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [splitPercent, setSplitPercent] = useState(50);
  const [dragging, setDragging] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateDetail | null>(null);
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});
  const [templateLoading, setTemplateLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMarkdownRef = useRef<string>("");
  const savingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const [site, templatesRes] = await Promise.all([
          getSite(token!),
          getTemplates({ limit: 50 }),
        ]);
        if (cancelled) return;

        setMarkdown(site.markdown);
        latestMarkdownRef.current = site.markdown;
        setTemplates(templatesRes.items);
        setSelectedTemplateId(site.templateId);
        setTemplateVariables(site.templateVariables);

        // Fetch full template details if site has one selected
        if (site.templateId) {
          const tmpl = templatesRes.items.find(
            (t) => t.templateId === site.templateId,
          );
          if (tmpl) {
            const detail = await getTemplateBySlug(tmpl.slug);
            if (!cancelled) setSelectedTemplate(detail);
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load site",
          );
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, navigate]);

  const showSaved = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
  }, []);

  const saveMarkdown = useCallback(
    async (value: string) => {
      if (!token || savingRef.current) return;
      savingRef.current = true;
      setSaveStatus("saving");
      try {
        await updateSite(token, { markdown: value });
        showSaved();
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
      }
    },
    [token, showSaved],
  );

  const saveTemplateSettings = useCallback(
    async (
      templateId: string | null,
      variables: Record<string, string>,
    ) => {
      if (!token) return;
      setSaveStatus("saving");
      try {
        await updateSite(token, { templateId, templateVariables: variables });
        showSaved();
      } catch {
        setSaveStatus("error");
      }
    },
    [token, showSaved],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!token) throw new Error("Not authenticated");
      return uploadImage(token, file);
    },
    [token],
  );

  const handleMarkdownChange = useCallback(
    (value: string) => {
      latestMarkdownRef.current = value;
      setMarkdown(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveMarkdown(latestMarkdownRef.current);
      }, AUTO_SAVE_DELAY);
    },
    [saveMarkdown],
  );

  const handleSelectTemplate = useCallback(
    async (templateId: string | null) => {
      setSelectedTemplateId(templateId);

      if (!templateId) {
        setSelectedTemplate(null);
        setTemplateVariables({});
        saveTemplateSettings(null, {});
        return;
      }

      const tmpl = templates.find((t) => t.templateId === templateId);
      if (!tmpl) return;

      setTemplateLoading(true);
      try {
        const detail = await getTemplateBySlug(tmpl.slug);
        setSelectedTemplate(detail);

        // Initialize with template defaults
        const defaults: Record<string, string> = {};
        for (const v of detail.variables) {
          defaults[v.name] = v.default;
        }
        setTemplateVariables(defaults);
        saveTemplateSettings(templateId, defaults);
      } catch {
        // Keep previous state on error
      } finally {
        setTemplateLoading(false);
      }
    },
    [templates, saveTemplateSettings],
  );

  const handleVariableChange = useCallback(
    (name: string, value: string) => {
      setTemplateVariables((prev) => {
        const next = { ...prev, [name]: value };

        if (templateTimerRef.current) clearTimeout(templateTimerRef.current);
        templateTimerRef.current = setTimeout(() => {
          saveTemplateSettings(selectedTemplateId, next);
        }, AUTO_SAVE_DELAY);

        return next;
      });
    },
    [selectedTemplateId, saveTemplateSettings],
  );

  const previewTemplate = useMemo(() => {
    if (!selectedTemplate) return undefined;
    return combineTemplateCss(selectedTemplate.html, selectedTemplate.css);
  }, [selectedTemplate]);

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

  // Flush pending saves on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestMarkdownRef.current !== markdown) {
          saveMarkdown(latestMarkdownRef.current);
        }
      }
      if (templateTimerRef.current) {
        clearTimeout(templateTimerRef.current);
      }
    };
    // Only run cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Editor</h1>
        <SaveIndicator status={saveStatus} />
      </div>
      <div ref={containerRef} className="relative flex min-h-0 flex-1">
        {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
        <div className="min-w-0 p-4" style={{ width: `${splitPercent}%` }}>
          <MarkdownEditor
            initialValue={markdown ?? ""}
            onChange={handleMarkdownChange}
            onImageUpload={handleImageUpload}
          />
        </div>
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/20 active:bg-primary/30"
          onMouseDown={handleDragStart}
        />
        <div
          className="flex min-w-0 flex-col"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <TemplateControls
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            selectedTemplate={selectedTemplate}
            variables={templateVariables}
            onSelectTemplate={handleSelectTemplate}
            onVariableChange={handleVariableChange}
            loading={templateLoading}
          />
          <div className="min-h-0 flex-1 p-4">
            <LivePreview
              markdown={markdown ?? ""}
              template={previewTemplate}
              variables={templateVariables}
            />
          </div>
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
          Save failed
        </span>
      );
    default:
      return null;
  }
}
