import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

// ---------------------------------------------------------------------------
// Frontmatter parsing / serialization (simple flat key-value YAML)
// ---------------------------------------------------------------------------

const FRONTMATTER_RE =
  /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/;

interface FrontmatterFields {
  title: string;
  description: string;
  ogImage: string;
}

function parseFrontmatter(markdown: string): {
  fields: FrontmatterFields;
  body: string;
  raw: Record<string, string>;
} {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return {
      fields: { title: "", description: "", ogImage: "" },
      body: markdown,
      raw: {},
    };
  }

  const raw: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    raw[key] = value;
  }

  return {
    fields: {
      title: raw["title"] ?? "",
      description: raw["description"] ?? "",
      ogImage: raw["ogImage"] ?? raw["og:image"] ?? "",
    },
    body: match[2],
    raw,
  };
}

function serializeFrontmatter(
  fields: FrontmatterFields,
  existingRaw: Record<string, string>,
  body: string,
): string {
  // Merge panel fields into existing raw frontmatter (preserves unknown keys)
  const merged = { ...existingRaw };

  if (fields.title) merged["title"] = fields.title;
  else delete merged["title"];

  if (fields.description) merged["description"] = fields.description;
  else delete merged["description"];

  if (fields.ogImage) merged["ogImage"] = fields.ogImage;
  else delete merged["ogImage"];

  // Remove the og:image alias if we're using ogImage
  if (merged["ogImage"]) delete merged["og:image"];

  const entries = Object.entries(merged);
  if (entries.length === 0) return body;

  const yamlLines = entries.map(([key, value]) => {
    // Quote values that contain special YAML characters
    if (/[:#{}[\],&*?|>!%@`]/.test(value) || value === "") {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
  });

  return `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FrontmatterPanelProps {
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
}

export function FrontmatterPanel({
  markdown,
  onMarkdownChange,
}: FrontmatterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<FrontmatterFields>({
    title: "",
    description: "",
    ogImage: "",
  });
  const rawRef = useRef<Record<string, string>>({});
  const bodyRef = useRef<string>("");
  const internalUpdate = useRef(false);

  // Sync panel fields from markdown (when markdown changes externally)
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    const parsed = parseFrontmatter(markdown);
    setFields(parsed.fields);
    rawRef.current = parsed.raw;
    bodyRef.current = parsed.body;
  }, [markdown]);

  const handleFieldChange = useCallback(
    (field: keyof FrontmatterFields, value: string) => {
      setFields((prev) => {
        const next = { ...prev, [field]: value };
        internalUpdate.current = true;
        const newMarkdown = serializeFrontmatter(
          next,
          rawRef.current,
          bodyRef.current,
        );
        onMarkdownChange(newMarkdown);
        return next;
      });
    },
    [onMarkdownChange],
  );

  return (
    <div className="shrink-0 border-b">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span>Page Metadata</span>
        {!expanded && fields.title && (
          <span className="truncate text-foreground">{fields.title}</span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          <div>
            <label
              htmlFor="fm-title"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Title
            </label>
            <Input
              id="fm-title"
              value={fields.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              placeholder="Page title"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="fm-description"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Description
            </label>
            <Textarea
              id="fm-description"
              value={fields.description}
              onChange={(e) =>
                handleFieldChange("description", e.target.value)
              }
              placeholder="Short description for SEO and social previews"
              className="min-h-[60px] resize-y text-xs"
              rows={2}
            />
          </div>
          <div>
            <label
              htmlFor="fm-ogimage"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Social Image (og:image)
            </label>
            <Input
              id="fm-ogimage"
              value={fields.ogImage}
              onChange={(e) => handleFieldChange("ogImage", e.target.value)}
              placeholder="https://..."
              className="h-8 text-xs"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Image shown when your page is shared on social media.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
