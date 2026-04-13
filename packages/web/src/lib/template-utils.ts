export const FONT_OPTIONS = [
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

export function combineTemplateCss(html: string, css: string): string {
  if (!css) return html;
  const styleTag = `<style>${css}</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}
