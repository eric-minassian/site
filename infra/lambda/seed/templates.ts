export interface CuratedTemplate {
  slug: string;
  name: string;
  description: string;
  html: string;
  css: string;
  variables: Array<{
    name: string;
    label: string;
    type: "color" | "font" | "number" | "select" | "text";
    default: string;
    options?: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Shared HTML shell — all templates use the same basic document structure
// ---------------------------------------------------------------------------

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Minimal
// ---------------------------------------------------------------------------

const minimal: CuratedTemplate = {
  slug: "minimal",
  name: "Minimal",
  description: "Ultra-clean design with generous whitespace and refined typography",
  html: shell(`  <main class="content">{{{content}}}</main>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #374151;
  background: #fff;
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
}
.content {
  max-width: {{{maxWidth}}};
  margin: 0 auto;
  padding: 4rem 1.5rem;
}
h1, h2, h3, h4, h5, h6 {
  color: #111827;
  font-weight: 600;
  line-height: 1.3;
  margin: 2em 0 0.5em;
}
h1 { font-size: 2.25rem; letter-spacing: -0.025em; }
h2 { font-size: 1.75rem; }
h3 { font-size: 1.375rem; }
p { margin: 1em 0; }
a { color: {{{primaryColor}}}; text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { text-decoration-thickness: 2px; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25em; overflow-x: auto; margin: 1.5em 0; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.5em 1.25em; margin: 1.5em 0; color: #6b7280; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
th, td { border: 1px solid #e5e7eb; padding: 0.625em 1em; text-align: left; }
th { background: #f9fafb; font-weight: 600; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 2.5em 0; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }
li { margin: 0.25em 0; }`,
  variables: [
    { name: "primaryColor", label: "Accent Color", type: "color", default: "#2563eb" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
    { name: "maxWidth", label: "Content Width", type: "text", default: "680px" },
  ],
};

// ---------------------------------------------------------------------------
// 2. Portfolio
// ---------------------------------------------------------------------------

const portfolio: CuratedTemplate = {
  slug: "portfolio",
  name: "Portfolio",
  description: "Professional showcase layout with bold header and card-style sections",
  html: shell(`  <header class="hero">
    <div class="hero-inner">
      <h1 class="hero-title">{{title}}</h1>
      {{#if description}}<p class="hero-sub">{{{description}}}</p>{{/if}}
    </div>
  </header>
  <main class="content">{{{content}}}</main>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #1f2937;
  background: #f8fafc;
  line-height: 1.7;
}
.hero {
  background: {{{primaryColor}}};
  color: #fff;
  padding: 4rem 1.5rem 3rem;
}
.hero-inner { max-width: 900px; margin: 0 auto; }
.hero-title { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.025em; }
.hero-sub { font-size: 1.125rem; margin-top: 0.75rem; opacity: 0.9; }
.content { max-width: 900px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
h2 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 2.5em 0 0.75em; padding-bottom: 0.5em; border-bottom: 2px solid {{{accentColor}}}; }
h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5em 0 0.5em; color: #374151; }
p { margin: 0.75em 0; }
a { color: {{{primaryColor}}}; font-weight: 500; }
img { max-width: 100%; height: auto; border-radius: 10px; margin: 1.5em 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
pre { background: #1e293b; color: #e2e8f0; border-radius: 10px; padding: 1.25em; overflow-x: auto; margin: 1.5em 0; }
code { font-size: 0.875em; }
code:not(pre code) { background: #e2e8f0; padding: 0.15em 0.4em; border-radius: 4px; color: #1e293b; }
blockquote { background: #fff; border-left: 4px solid {{{primaryColor}}}; padding: 1em 1.5em; margin: 1.5em 0; border-radius: 0 8px 8px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
th, td { padding: 0.75em 1em; text-align: left; border-bottom: 1px solid #e5e7eb; }
th { background: #f1f5f9; font-weight: 600; }
hr { border: none; border-top: 2px solid #e2e8f0; margin: 2.5em 0; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }`,
  variables: [
    { name: "primaryColor", label: "Primary Color", type: "color", default: "#0f172a" },
    { name: "accentColor", label: "Accent Color", type: "color", default: "#3b82f6" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
  ],
};

// ---------------------------------------------------------------------------
// 3. Resume
// ---------------------------------------------------------------------------

const resume: CuratedTemplate = {
  slug: "resume",
  name: "Resume",
  description: "Clean, print-friendly CV layout with structured sections and subtle accents",
  html: shell(`  <main class="page">
    <header class="header">
      <h1 class="name">{{title}}</h1>
      {{#if description}}<p class="tagline">{{{description}}}</p>{{/if}}
    </header>
    <div class="body">{{{content}}}</div>
  </main>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #1f2937;
  background: #f3f4f6;
  line-height: 1.65;
  font-size: 15px;
}
.page {
  max-width: 800px;
  margin: 2rem auto;
  background: #fff;
  padding: 3rem;
  box-shadow: 0 1px 8px rgba(0,0,0,0.08);
  border-radius: 4px;
}
.header { border-bottom: 3px solid {{{primaryColor}}}; padding-bottom: 1.25rem; margin-bottom: 1.5rem; }
.name { font-size: 2rem; font-weight: 700; color: {{{primaryColor}}}; letter-spacing: -0.02em; }
.tagline { color: #6b7280; margin-top: 0.25rem; font-size: 1.05rem; }
h2 { font-size: 1.15rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: {{{primaryColor}}}; margin: 2em 0 0.75em; padding-bottom: 0.35em; border-bottom: 1px solid #e5e7eb; }
h3 { font-size: 1.05rem; font-weight: 600; margin: 1.25em 0 0.25em; }
p { margin: 0.5em 0; }
a { color: {{{primaryColor}}}; }
ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
li { margin: 0.2em 0; }
strong { color: #111827; }
pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.75em; overflow-x: auto; margin: 1em 0; font-size: 0.85em; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.25em 1em; margin: 1em 0; color: #6b7280; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
th { background: #f9fafb; font-weight: 600; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
img { max-width: 100%; height: auto; border-radius: 4px; margin: 1em 0; }
@media print {
  body { background: #fff; }
  .page { box-shadow: none; margin: 0; padding: 1.5rem; }
}`,
  variables: [
    { name: "primaryColor", label: "Accent Color", type: "color", default: "#1e40af" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
  ],
};

// ---------------------------------------------------------------------------
// 4. Blog
// ---------------------------------------------------------------------------

const blog: CuratedTemplate = {
  slug: "blog",
  name: "Blog",
  description: "Article-focused layout optimized for long-form reading with elegant typography",
  html: shell(`  <article class="article">
    <header class="article-header">
      <h1 class="article-title">{{title}}</h1>
      {{#if date}}<time class="article-date">{{{date}}}</time>{{/if}}
      {{#if description}}<p class="article-excerpt">{{{description}}}</p>{{/if}}
    </header>
    <div class="article-body">{{{content}}}</div>
  </article>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #292524;
  background: #fafaf9;
  line-height: 1.85;
  font-size: 17px;
}
.article { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
.article-header { margin-bottom: 2.5rem; }
.article-title { font-size: 2.5rem; font-weight: 800; color: #1c1917; letter-spacing: -0.03em; line-height: 1.2; }
.article-date { display: block; margin-top: 0.75rem; color: #a8a29e; font-size: 0.9rem; }
.article-excerpt { margin-top: 1rem; font-size: 1.2rem; color: #78716c; line-height: 1.6; }
.article-body h2 { font-size: 1.6rem; font-weight: 700; margin: 2.5em 0 0.5em; color: #1c1917; }
.article-body h3 { font-size: 1.3rem; font-weight: 600; margin: 2em 0 0.5em; color: #292524; }
p { margin: 1.25em 0; }
a { color: {{{primaryColor}}}; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 2em 0; }
pre { background: #1c1917; color: #e7e5e4; border-radius: 8px; padding: 1.25em 1.5em; overflow-x: auto; margin: 2em 0; font-size: 0.9rem; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f5f5f4; padding: 0.15em 0.4em; border-radius: 4px; color: #44403c; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.75em 1.5em; margin: 2em 0; font-style: italic; color: #57534e; font-size: 1.1rem; }
table { border-collapse: collapse; width: 100%; margin: 2em 0; }
th, td { border-bottom: 1px solid #e7e5e4; padding: 0.75em 1em; text-align: left; }
th { font-weight: 600; color: #1c1917; }
hr { border: none; height: 3px; background: #e7e5e4; margin: 3em auto; width: 60px; border-radius: 2px; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }
li { margin: 0.35em 0; }`,
  variables: [
    { name: "primaryColor", label: "Link Color", type: "color", default: "#b45309" },
    { name: "fontFamily", label: "Font", type: "font", default: "Georgia, serif" },
  ],
};

// ---------------------------------------------------------------------------
// 5. Developer
// ---------------------------------------------------------------------------

const developer: CuratedTemplate = {
  slug: "developer",
  name: "Developer",
  description: "Terminal-inspired dark theme with monospace typography and code-first aesthetic",
  html: shell(`  <div class="terminal">
    <div class="terminal-bar">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
      <span class="terminal-title">{{title}}</span>
    </div>
    <main class="terminal-body">{{{content}}}</main>
  </div>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  background: {{{bgColor}}};
  color: {{{textColor}}};
  line-height: 1.7;
  font-size: 15px;
}
.terminal { max-width: 860px; margin: 2rem auto; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
.terminal-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #1e293b; }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot-red { background: #ef4444; }
.dot-yellow { background: #eab308; }
.dot-green { background: #22c55e; }
.terminal-title { margin-left: 8px; font-size: 0.8rem; color: #94a3b8; }
.terminal-body { padding: 2rem 2.5rem 3rem; }
h1, h2, h3, h4, h5, h6 { color: {{{primaryColor}}}; font-weight: 600; margin: 2em 0 0.5em; }
h1 { font-size: 1.75rem; }
h1::before { content: "# "; color: #475569; }
h2 { font-size: 1.4rem; }
h2::before { content: "## "; color: #475569; }
h3 { font-size: 1.15rem; }
h3::before { content: "### "; color: #475569; }
p { margin: 0.75em 0; }
a { color: {{{primaryColor}}}; text-decoration: none; border-bottom: 1px dashed {{{primaryColor}}}; }
a:hover { border-bottom-style: solid; }
img { max-width: 100%; height: auto; border-radius: 6px; margin: 1.5em 0; border: 1px solid #334155; }
pre { background: #020617; border: 1px solid #334155; border-radius: 6px; padding: 1.25em; overflow-x: auto; margin: 1.5em 0; }
code { font-size: 0.9em; font-family: {{{fontFamily}}}; }
code:not(pre code) { background: #1e293b; padding: 0.15em 0.5em; border-radius: 4px; color: {{{primaryColor}}}; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.5em 1.25em; margin: 1.5em 0; color: #94a3b8; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
th, td { border: 1px solid #334155; padding: 0.5em 1em; text-align: left; }
th { background: #1e293b; color: {{{primaryColor}}}; font-weight: 600; }
hr { border: none; border-top: 1px dashed #334155; margin: 2em 0; }
ul, ol { padding-left: 1.75em; margin: 0.75em 0; }
li { margin: 0.2em 0; }
li::marker { color: {{{primaryColor}}}; }
strong { color: #f8fafc; }`,
  variables: [
    { name: "primaryColor", label: "Accent Color", type: "color", default: "#22d3ee" },
    { name: "bgColor", label: "Background", type: "color", default: "#0f172a" },
    { name: "textColor", label: "Text Color", type: "color", default: "#cbd5e1" },
    { name: "fontFamily", label: "Font", type: "font", default: "'Courier New', monospace" },
  ],
};

// ---------------------------------------------------------------------------
// 6. Academic
// ---------------------------------------------------------------------------

const academic: CuratedTemplate = {
  slug: "academic",
  name: "Academic",
  description: "Scholarly paper-style layout with serif typography and structured sections",
  html: shell(`  <article class="paper">
    <header class="paper-header">
      <h1 class="paper-title">{{title}}</h1>
      {{#if author}}<p class="paper-author">{{{author}}}</p>{{/if}}
      {{#if date}}<p class="paper-date">{{{date}}}</p>{{/if}}
      {{#if description}}<div class="paper-abstract"><strong>Abstract.</strong> {{{description}}}</div>{{/if}}
    </header>
    <div class="paper-body">{{{content}}}</div>
  </article>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #1a1a1a;
  background: #f5f5f0;
  line-height: 1.8;
  font-size: 16px;
}
.paper {
  max-width: 700px;
  margin: 2.5rem auto;
  padding: 3rem 2.5rem;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
}
.paper-header { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #d4d4d0; }
.paper-title { font-size: 1.75rem; font-weight: 700; line-height: 1.3; }
.paper-author { margin-top: 0.75rem; font-size: 1.05rem; color: #555; }
.paper-date { margin-top: 0.25rem; font-size: 0.9rem; color: #888; }
.paper-abstract { margin-top: 1.25rem; text-align: left; padding: 1em 1.25em; background: #fafaf7; border: 1px solid #e5e5e0; border-radius: 4px; font-size: 0.95rem; color: #444; }
.paper-body h2 { font-size: 1.3rem; font-weight: 700; margin: 2.5em 0 0.5em; color: {{{primaryColor}}}; }
.paper-body h3 { font-size: 1.1rem; font-weight: 600; margin: 2em 0 0.5em; font-style: italic; }
p { margin: 0.85em 0; text-align: justify; hyphens: auto; }
a { color: {{{primaryColor}}}; }
img { max-width: 100%; height: auto; margin: 1.5em auto; display: block; }
pre { background: #f9f9f5; border: 1px solid #e5e5e0; border-radius: 4px; padding: 1em; overflow-x: auto; margin: 1.5em 0; font-size: 0.875em; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f0f0ec; padding: 0.1em 0.35em; border-radius: 3px; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.5em 1.25em; margin: 1.5em 0; font-style: italic; color: #555; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; font-size: 0.95em; }
th, td { border: 1px solid #d4d4d0; padding: 0.5em 0.75em; text-align: left; }
th { background: #fafaf7; font-weight: 600; }
caption { font-size: 0.9em; color: #666; margin-bottom: 0.5em; font-style: italic; }
hr { border: none; border-top: 1px solid #d4d4d0; margin: 2em 0; }
ul, ol { padding-left: 1.75em; margin: 0.85em 0; }
sup { font-size: 0.75em; }`,
  variables: [
    { name: "primaryColor", label: "Accent Color", type: "color", default: "#7c2d12" },
    { name: "fontFamily", label: "Font", type: "font", default: "Georgia, serif" },
  ],
};

// ---------------------------------------------------------------------------
// 7. Creative
// ---------------------------------------------------------------------------

const creative: CuratedTemplate = {
  slug: "creative",
  name: "Creative",
  description: "Bold, artistic design with vibrant gradients and expressive typography",
  html: shell(`  <div class="page">
    <header class="banner">
      <h1 class="banner-title">{{title}}</h1>
    </header>
    <main class="content">{{{content}}}</main>
  </div>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #1a1a2e;
  background: {{{bgColor}}};
  line-height: 1.75;
}
.banner {
  background: linear-gradient(135deg, {{{primaryColor}}}, {{{accentColor}}});
  padding: 4rem 2rem 3.5rem;
  text-align: center;
}
.banner-title {
  font-size: 3rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.content { max-width: 780px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
h2 {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 2em 0 0.5em;
  background: linear-gradient(135deg, {{{primaryColor}}}, {{{accentColor}}});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
h3 { font-size: 1.35rem; font-weight: 700; margin: 1.5em 0 0.5em; color: #1a1a2e; }
p { margin: 1em 0; }
a { color: {{{primaryColor}}}; font-weight: 600; text-decoration: none; border-bottom: 2px solid {{{accentColor}}}; }
a:hover { border-bottom-width: 3px; }
img { max-width: 100%; height: auto; border-radius: 16px; margin: 2em 0; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
pre { background: #1a1a2e; color: #e2e8f0; border-radius: 12px; padding: 1.5em; overflow-x: auto; margin: 2em 0; }
code { font-size: 0.875em; }
code:not(pre code) { background: #ede9fe; padding: 0.15em 0.5em; border-radius: 6px; color: #5b21b6; }
blockquote {
  background: linear-gradient(135deg, {{{primaryColor}}}15, {{{accentColor}}}15);
  border-left: 4px solid {{{primaryColor}}};
  border-radius: 0 12px 12px 0;
  padding: 1.25em 1.5em;
  margin: 2em 0;
  font-size: 1.1rem;
  font-style: italic;
}
table { border-collapse: collapse; width: 100%; margin: 2em 0; border-radius: 12px; overflow: hidden; }
th, td { padding: 0.75em 1em; text-align: left; border-bottom: 1px solid #e5e7eb; }
th { background: linear-gradient(135deg, {{{primaryColor}}}, {{{accentColor}}}); color: #fff; font-weight: 600; }
hr { border: none; height: 4px; background: linear-gradient(90deg, {{{primaryColor}}}, {{{accentColor}}}); margin: 3em 0; border-radius: 2px; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }
li { margin: 0.35em 0; }`,
  variables: [
    { name: "primaryColor", label: "Primary Color", type: "color", default: "#7c3aed" },
    { name: "accentColor", label: "Accent Color", type: "color", default: "#ec4899" },
    { name: "bgColor", label: "Background", type: "color", default: "#faf5ff" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
  ],
};

// ---------------------------------------------------------------------------
// 8. Dark Mode
// ---------------------------------------------------------------------------

const darkMode: CuratedTemplate = {
  slug: "dark-mode",
  name: "Dark Mode",
  description: "Comfortable dark theme with balanced contrast and warm accent colors",
  html: shell(`  <main class="content">{{{content}}}</main>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: {{{textColor}}};
  background: {{{bgColor}}};
  line-height: 1.8;
  -webkit-font-smoothing: antialiased;
}
.content { max-width: 720px; margin: 0 auto; padding: 3.5rem 1.5rem 4rem; }
h1, h2, h3, h4, h5, h6 { color: #f1f5f9; font-weight: 600; line-height: 1.3; margin: 2em 0 0.5em; }
h1 { font-size: 2.25rem; letter-spacing: -0.025em; }
h2 { font-size: 1.65rem; }
h3 { font-size: 1.3rem; }
p { margin: 1em 0; }
a { color: {{{primaryColor}}}; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; }
pre { background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 1.25em; overflow-x: auto; margin: 1.5em 0; }
code { font-size: 0.875em; }
code:not(pre code) { background: #1e293b; padding: 0.15em 0.45em; border-radius: 4px; color: {{{primaryColor}}}; }
blockquote { border-left: 3px solid {{{primaryColor}}}; padding: 0.5em 1.25em; margin: 1.5em 0; color: #94a3b8; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
th, td { border: 1px solid #1e293b; padding: 0.625em 1em; text-align: left; }
th { background: #1e293b; font-weight: 600; color: #f1f5f9; }
hr { border: none; border-top: 1px solid #1e293b; margin: 2.5em 0; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }
li { margin: 0.3em 0; }
strong { color: #f1f5f9; }`,
  variables: [
    { name: "primaryColor", label: "Accent Color", type: "color", default: "#f59e0b" },
    { name: "bgColor", label: "Background", type: "color", default: "#0f172a" },
    { name: "textColor", label: "Text Color", type: "color", default: "#cbd5e1" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
  ],
};

// ---------------------------------------------------------------------------
// 9. Landing
// ---------------------------------------------------------------------------

const landing: CuratedTemplate = {
  slug: "landing",
  name: "Landing",
  description: "Bold hero-style layout with centered content and strong visual presence",
  html: shell(`  <header class="hero">
    <div class="hero-inner">
      <h1 class="hero-heading">{{title}}</h1>
      {{#if description}}<p class="hero-sub">{{{description}}}</p>{{/if}}
    </div>
  </header>
  <main class="content">{{{content}}}</main>
  <footer class="footer">
    <p>{{title}}</p>
  </footer>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #374151;
  background: #fff;
  line-height: 1.75;
}
.hero {
  background: {{{heroColor}}};
  padding: 6rem 2rem;
  text-align: center;
}
.hero-inner { max-width: 700px; margin: 0 auto; }
.hero-heading { font-size: 3rem; font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1.15; }
.hero-sub { font-size: 1.25rem; color: rgba(255,255,255,0.85); margin-top: 1rem; line-height: 1.6; }
.content { max-width: 760px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
h2 { font-size: 1.75rem; font-weight: 700; color: #111827; margin: 2em 0 0.5em; text-align: center; }
h3 { font-size: 1.35rem; font-weight: 600; margin: 1.5em 0 0.5em; color: #374151; }
p { margin: 1em 0; }
a { color: {{{heroColor}}}; font-weight: 500; }
img { max-width: 100%; height: auto; border-radius: 12px; margin: 2em 0; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
pre { background: #111827; color: #e5e7eb; border-radius: 10px; padding: 1.25em; overflow-x: auto; margin: 1.5em 0; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; }
blockquote { text-align: center; border: none; font-size: 1.25rem; color: #6b7280; font-style: italic; margin: 2em 0; padding: 1em; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 0.75em 1em; text-align: left; }
th { font-weight: 600; color: #111827; }
hr { border: none; border-top: 1px solid #e5e7eb; margin: 2.5em 0; }
ul, ol { padding-left: 1.75em; margin: 1em 0; }
.footer { text-align: center; padding: 2rem 1.5rem; color: #9ca3af; font-size: 0.875rem; border-top: 1px solid #e5e7eb; }`,
  variables: [
    { name: "heroColor", label: "Hero Color", type: "color", default: "#111827" },
    { name: "fontFamily", label: "Font", type: "font", default: "system-ui, sans-serif" },
  ],
};

// ---------------------------------------------------------------------------
// 10. Notebook
// ---------------------------------------------------------------------------

const notebook: CuratedTemplate = {
  slug: "notebook",
  name: "Notebook",
  description: "Warm, journal-style design with a cozy paper-like texture and soft tones",
  html: shell(`  <div class="notebook">
    <header class="notebook-header">
      <h1 class="notebook-title">{{title}}</h1>
      {{#if date}}<span class="notebook-date">{{{date}}}</span>{{/if}}
    </header>
    <main class="notebook-body">{{{content}}}</main>
  </div>`),
  css: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: {{{fontFamily}}};
  color: #44403c;
  background: #efebe4;
  line-height: 1.8;
}
.notebook {
  max-width: 720px;
  margin: 2rem auto;
  background: {{{bgColor}}};
  padding: 3rem 3rem 3rem 4rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  border-radius: 2px;
  border-left: 4px solid {{{accentColor}}};
  position: relative;
}
.notebook::before {
  content: "";
  position: absolute;
  left: 2.5rem;
  top: 0;
  bottom: 0;
  width: 1px;
  background: {{{accentColor}}}40;
}
.notebook-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #d6d3d1; }
.notebook-title { font-size: 1.75rem; font-weight: 700; color: #1c1917; }
.notebook-date { font-size: 0.85rem; color: #a8a29e; margin-top: 0.25rem; display: block; }
.notebook-body h2 { font-size: 1.4rem; font-weight: 700; color: {{{accentColor}}}; margin: 2em 0 0.5em; }
.notebook-body h3 { font-size: 1.15rem; font-weight: 600; margin: 1.5em 0 0.5em; color: #57534e; }
p { margin: 0.85em 0; }
a { color: {{{accentColor}}}; }
img { max-width: 100%; height: auto; border-radius: 4px; margin: 1.5em 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
pre { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 6px; padding: 1em; overflow-x: auto; margin: 1.5em 0; font-size: 0.875em; }
code { font-size: 0.875em; }
code:not(pre code) { background: #f5f5f4; padding: 0.1em 0.35em; border-radius: 3px; }
blockquote { border-left: 3px solid {{{accentColor}}}; padding: 0.5em 1.25em; margin: 1.5em 0; color: #78716c; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
th, td { border: 1px solid #d6d3d1; padding: 0.5em 0.75em; text-align: left; }
th { background: #fafaf9; font-weight: 600; }
hr { border: none; border-top: 1px dashed #d6d3d1; margin: 2em 0; }
ul, ol { padding-left: 1.75em; margin: 0.85em 0; }
li { margin: 0.25em 0; }`,
  variables: [
    { name: "accentColor", label: "Accent Color", type: "color", default: "#b45309" },
    { name: "bgColor", label: "Page Color", type: "color", default: "#fefcf8" },
    { name: "fontFamily", label: "Font", type: "font", default: "Georgia, serif" },
  ],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const curatedTemplates: CuratedTemplate[] = [
  minimal,
  portfolio,
  resume,
  blog,
  developer,
  academic,
  creative,
  darkMode,
  landing,
  notebook,
];
