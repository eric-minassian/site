import { describe, expect, it } from "vitest";
import { render } from "../src/index.js";

describe("render", () => {
  // ------------------------------------------------------------------
  // Basic markdown
  // ------------------------------------------------------------------

  it("renders plain markdown to HTML", async () => {
    const { html } = await render("# Hello\n\nWorld");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<p>World</p>");
  });

  it("returns empty frontmatter when none provided", async () => {
    const { frontmatter } = await render("Hello");
    expect(frontmatter).toEqual({});
  });

  // ------------------------------------------------------------------
  // Frontmatter
  // ------------------------------------------------------------------

  it("extracts YAML frontmatter", async () => {
    const md = `---
title: My Page
tags:
  - a
  - b
---

Content here`;
    const { frontmatter, html } = await render(md);
    expect(frontmatter).toEqual({ title: "My Page", tags: ["a", "b"] });
    expect(html).toContain("<p>Content here</p>");
    expect(html).not.toContain("title");
  });

  // ------------------------------------------------------------------
  // GFM (tables, strikethrough, autolinks, task lists)
  // ------------------------------------------------------------------

  it("renders GFM tables", async () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const { html } = await render(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders strikethrough", async () => {
    const { html } = await render("~~deleted~~");
    expect(html).toContain("<del>deleted</del>");
  });

  it("renders task lists", async () => {
    const md = "- [x] done\n- [ ] todo";
    const { html } = await render(md);
    expect(html).toContain('type="checkbox"');
  });

  // ------------------------------------------------------------------
  // Math (KaTeX)
  // ------------------------------------------------------------------

  it("renders inline math", async () => {
    const { html } = await render("Inline $x^2$ here");
    expect(html).toContain("katex");
  });

  it("renders block math", async () => {
    const { html } = await render("$$\nE = mc^2\n$$");
    expect(html).toContain("katex");
  });

  // ------------------------------------------------------------------
  // Syntax highlighting
  // ------------------------------------------------------------------

  it("highlights fenced code blocks", async () => {
    const md = "```js\nconst x = 1;\n```";
    const { html } = await render(md);
    expect(html).toContain("hljs");
  });

  // ------------------------------------------------------------------
  // Templates
  // ------------------------------------------------------------------

  it("injects content into a Handlebars template", async () => {
    const template = `<html><body>{{{content}}}</body></html>`;
    const { html } = await render("# Hi", { template });
    expect(html).toBe("<html><body><h1>Hi</h1></body></html>");
  });

  it("passes frontmatter variables to the template", async () => {
    const md = `---\ntitle: Test\n---\nBody`;
    const template = `<h1>{{title}}</h1>{{{content}}}`;
    const { html } = await render(md, { template });
    expect(html).toContain("<h1>Test</h1>");
    expect(html).toContain("<p>Body</p>");
  });

  it("passes user variables to the template", async () => {
    const template = `<div style="color:{{color}}">{{{content}}}</div>`;
    const { html } = await render("Hi", {
      template,
      variables: { color: "red" },
    });
    expect(html).toContain('style="color:red"');
  });

  it("user variables override frontmatter", async () => {
    const md = `---\ncolor: blue\n---\nHi`;
    const template = `{{color}}`;
    const { html } = await render(md, {
      template,
      variables: { color: "red" },
    });
    expect(html).toBe("red");
  });

  // ------------------------------------------------------------------
  // Sanitization
  // ------------------------------------------------------------------

  it("strips script tags when sanitize is enabled", async () => {
    const md = `<script>alert(1)</script>\n\nSafe`;
    const { html } = await render(md, { sanitize: true });
    expect(html).not.toContain("<script>");
    expect(html).toContain("Safe");
  });

  it("strips event handlers when sanitize is enabled", async () => {
    const md = `<div onclick="alert(1)">Hi</div>`;
    const { html } = await render(md, { sanitize: true });
    expect(html).not.toContain("onclick");
  });

  it("preserves highlight classes when sanitize is enabled", async () => {
    const md = "```js\nconst x = 1;\n```";
    const { html } = await render(md, { sanitize: true });
    expect(html).toContain("hljs");
  });

  it("allows raw HTML through when sanitize is disabled", async () => {
    const md = `<div class="custom">Hi</div>`;
    const { html } = await render(md, { sanitize: false });
    expect(html).toContain('<div class="custom">Hi</div>');
  });

  // ------------------------------------------------------------------
  // Edge cases
  // ------------------------------------------------------------------

  it("handles empty markdown", async () => {
    const { html, frontmatter } = await render("");
    expect(html).toBe("");
    expect(frontmatter).toEqual({});
  });

  it("handles markdown with only frontmatter", async () => {
    const md = `---\ntitle: Only FM\n---`;
    const { html, frontmatter } = await render(md);
    expect(frontmatter).toEqual({ title: "Only FM" });
    expect(html.trim()).toBe("");
  });

  it("handles default template (no template option)", async () => {
    const { html } = await render("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });
});
