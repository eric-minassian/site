# Requirements

## Authentication & Identity

- R1. When a user creates a site, they choose a username and receive a 12-word passphrase (BIP-39 wordlist, 128 bits of entropy)
- R2. The passphrase is the sole authentication mechanism — no passwords, no OAuth, no third-party integrations
- R3. We store only a SHA-256 hash of the passphrase; the words are shown once at creation and never stored
- R4. Users authenticate by entering their passphrase; the client derives a token and sends it via `Authorization: Bearer <token>`
- R5. Users can regenerate their passphrase (invalidates the old one)
- R6. Users can delete their site and all associated data using their passphrase
- R7. Usernames are unique and URL-safe (used as subdomain)

## Site Management

- R8. Each user has exactly one site (single page)
- R9. Users upload or write markdown content that becomes their site
- R10. Markdown is converted to styled HTML using a chosen template
- R11. Users can update their markdown content at any time; site regenerates on save
- R12. Generated sites are static HTML/CSS served from a CDN

## Template & Theming

- R13. Platform ships a set of curated default templates
- R14. Templates define the full HTML structure, CSS styling, and layout for rendering markdown
- R15. Templates support customizable variables (colors, fonts, spacing, accent colors, etc.)
- R16. Users can create and publish their own templates
- R17. All templates are public — no private templates
- R18. Templates use a standard format so any user can fork and modify an existing template

## Theme Marketplace

- R19. A browsable, searchable marketplace of all available templates
- R20. Each template has a preview showing sample content rendered with that template
- R21. Templates display author info, usage count, and creation date
- R22. Users can "use" any template from the marketplace for their site
- R23. Users can fork any template as a starting point for their own

## Live Preview Builder

- R24. An interactive builder page where users can edit markdown and see real-time HTML output
- R25. Builder shows a split-pane view: markdown editor on one side, rendered preview on the other
- R26. Users can switch templates in the builder and immediately see the result
- R27. Users can adjust template variables (colors, fonts, etc.) via controls and see changes live
- R28. Builder works for both editing site content and for designing/previewing templates
- R29. Builder supports mobile-responsive preview (toggle between viewport sizes)

## Hosting & Domains

- R30. Every site gets a default subdomain: `{username}.{platform-domain}`
- R31. Users can optionally connect a custom domain to their site
- R32. Platform provides clear DNS configuration instructions for custom domains
- R33. All sites are served over HTTPS (automatic SSL for both subdomains and custom domains)
- R34. Sites are served from edge locations for fast global access

## Content & Markdown

- R35. Support standard CommonMark markdown
- R36. Support common extensions: tables, footnotes, syntax highlighting, math (KaTeX), task lists
- R37. Support frontmatter (YAML) for page metadata (title, description, og:image, etc.)
- R38. Users can upload images; images are stored and served from CDN
- R39. Image uploads capped at 2MB per file, 10MB total per site; markdown content capped at 500KB

## Content Security

- R40. All generated sites served with `Content-Security-Policy: script-src 'none'` — no JavaScript execution on hosted sites
- R41. Template HTML sanitized server-side at build time: no `<script>`, no inline event handlers (`onclick`, `onerror`, etc.), no `<iframe>`/`<embed>`/`<object>`, no `javascript:` URLs
- R42. `<form>` elements stripped from templates — no credential harvesting
- R43. Markdown content sanitized via `rehype-sanitize` during build
- R44. Every hosted site includes a small "Report abuse" link
- R45. Abuse reports stored for review; sites can be suspended (returns HTTP 451)
- R46. Periodic automated checks against Google Safe Browsing API; auto-suspend flagged sites
- R47. Rate limit site creation per IP to prevent mass spam site creation
- R48. Image uploads capped at 2MB per file, 10MB total per site

## Operational

- R49. Service is entirely free — no paid tiers
- R50. Infrastructure costs should be minimal and scale with usage (serverless/pay-per-use)
- R51. No admin panel needed initially — operational concerns handled via infrastructure tooling
- R52. Rate limiting on API endpoints to prevent abuse
- R53. Aggressive caching on generated sites — static content rarely changes, serve from edge
