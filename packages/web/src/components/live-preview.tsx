import { useEffect, useRef, useState } from "react";
import { render } from "@site/renderer";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "./ui/button";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const DEBOUNCE_MS = 150;

const BASE_STYLES = `
  body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 1.5rem; margin: 0; }
  img { max-width: 100%; height: auto; }
  pre { overflow-x: auto; padding: 1em; background: #f6f8fa; border-radius: 6px; }
  code { font-size: 0.875em; }
  pre code { background: none; padding: 0; }
  code:not(pre code) { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f6f8fa; }
  blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #555; }
  a { color: #0366d6; }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.3; }
  h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  p { margin: 0.75em 0; }
  ul, ol { padding-left: 2em; }
  hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
  .task-list-item { list-style: none; margin-left: -1.5em; }
  .task-list-item input { margin-right: 0.5em; }
`;

function buildSrcdoc(html: string): string {
  if (/^\s*<!doctype|^\s*<html/i.test(html)) {
    const cssLinks =
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css">';
    if (html.includes("</head>")) {
      return html.replace("</head>", `${cssLinks}</head>`);
    }
    return cssLinks + html;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css">
  <style>${BASE_STYLES}</style>
</head>
<body>${html}</body>
</html>`;
}

interface LivePreviewProps {
  markdown: string;
  template?: string;
  variables?: Record<string, unknown>;
}

export function LivePreview({ markdown, template, variables }: LivePreviewProps) {
  const [html, setHtml] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await render(markdown, { template, variables });
        setHtml(result.html);
      } catch (err) {
        console.warn("Preview render error:", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [markdown, template, variables]);

  const srcdoc = buildSrcdoc(html);

  const viewports: Array<{ vp: Viewport; icon: typeof Monitor; label: string }> = [
    { vp: "desktop", icon: Monitor, label: "Desktop" },
    { vp: "tablet", icon: Tablet, label: "Tablet" },
    { vp: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center gap-0.5 border-b bg-muted/50 px-2 py-1">
        <span className="mr-auto text-xs font-medium text-muted-foreground">Preview</span>
        {viewports.map(({ vp, icon: Icon, label }) => (
          <Button
            key={vp}
            variant={viewport === vp ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewport(vp)}
            title={label}
            aria-label={`${label} preview`}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
        <iframe
          sandbox=""
          srcDoc={srcdoc}
          className="h-full border bg-white transition-[width] duration-200"
          style={{ width: VIEWPORT_WIDTHS[viewport] }}
          title="Site preview"
        />
      </div>
    </div>
  );
}
