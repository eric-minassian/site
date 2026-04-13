import Handlebars from "handlebars";
import { parse as parseYaml } from "yaml";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Template HTML with Handlebars syntax. `{{{content}}}` is replaced with rendered markdown. */
  template?: string;
  /** Variables passed to the Handlebars template alongside frontmatter. */
  variables?: Record<string, unknown>;
  /** Enable HTML sanitization (use on server / build pipeline). */
  sanitize?: boolean;
}

export interface RenderResult {
  /** Final HTML string. */
  html: string;
  /** Frontmatter key-value pairs extracted from the markdown. */
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Sanitization schema — extends default to allow highlight.js classes + KaTeX
// ---------------------------------------------------------------------------

const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.["code"] ?? []),
      ["className", /^language-./],
    ],
    span: [
      ...(defaultSchema.attributes?.["span"] ?? []),
      ["className", /^(hljs|katex|math)/],
    ],
    div: [
      ...(defaultSchema.attributes?.["div"] ?? []),
      ["className", /^(math|katex)/],
    ],
  },
};

// ---------------------------------------------------------------------------
// Pipeline builders
// ---------------------------------------------------------------------------

function buildProcessor(sanitize: boolean) {
  let processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: !sanitize })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeKatex);

  if (sanitize) {
    processor = processor.use(rehypeSanitize, sanitizeSchema);
  }

  return processor.use(rehypeStringify, {
    allowDangerousHtml: !sanitize,
  });
}

// ---------------------------------------------------------------------------
// Frontmatter extraction (browser-compatible replacement for gray-matter)
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/;

function extractFrontmatter(input: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const match = FRONTMATTER_RE.exec(input);
  if (!match) return { data: {}, content: input };
  try {
    const raw = parseYaml(match[1]);
    const data = raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
    return { data, content: match[2] };
  } catch {
    return { data: {}, content: input };
  }
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATE = "{{{content}}}";

function applyTemplate(
  template: string,
  content: string,
  frontmatter: Record<string, unknown>,
  variables: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(template, { noEscape: false });
  return compiled({ ...frontmatter, ...variables, content });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render markdown (with optional frontmatter) through a Handlebars template.
 *
 * Works in both Node.js and the browser.
 */
export async function render(
  markdown: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const { template = DEFAULT_TEMPLATE, variables = {}, sanitize = false } = options;

  // 1. Extract frontmatter
  const { data: frontmatter, content: markdownBody } = extractFrontmatter(markdown);

  // 2. Markdown → HTML
  const processor = buildProcessor(sanitize);
  const vfile = await processor.process(markdownBody);
  const contentHtml = String(vfile);

  // 3. Template
  const html = applyTemplate(template, contentHtml, frontmatter, variables);

  return { html, frontmatter };
}
