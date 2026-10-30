# ADR-0008 — Rich stored Markdown

- **Status:** Accepted; the blog it was written for was abandoned (see below), the Markdown stays
- **Date:** 2026-10-30
- **Phase:** P7

## Context

Projects, experiences and the about page keep their long texts as Markdown in the database, edited in the admin ([ADR-0007](0007-admin.md)). A technical text needs code blocks that read well and asides: a note, a warning, a solution folded away. The CSP is strict ([ADR-0002](0002-csp.md)).

These decisions were made for a blog of articles and CTF write-ups (P7a), shipped on 2026-10-30. The user abandoned the blog the same day: its posts, pages, admin, home tile and tables were removed (migration `0006_drop_posts`), and with them the table of contents and the reading time. What the blog brought to stored Markdown stays, for the texts above.

## Decisions

### Markdown with directives, never MDX

Stored texts are GFM Markdown with three directives, `:::note`, `:::warning` and `:::details` (`remark-directive`). MDX was ruled out: MDX stored in a database is code the site would run. A callout is named in the language of its text, not the page's: an English text shown as a fallback on a French page says "Warning". Any other directive reads as the text it was written as ("Raison:valeur" stays as typed), and a directive's attributes (`{.class #id style=… onclick=…}`) are dropped: nothing an author writes becomes an attribute of the page.

### One renderer, on demand, cached

Every stored Markdown goes through the same component (`src/components/content/markdown.tsx`), with the directives, heading ids and code colours; the admin's preview uses it too. Pages render it when they are rendered, inside their cached reads and pages, rather than storing HTML at save time as first planned (decided by the user on 2026-10-29): there is a single engine, and an image of the library or its description changes everywhere at once without re-rendering anything. Shiki colours the code with its JavaScript regex engine (no WebAssembly), the plan's languages and a few common ones (PHP, HTML, HTTP, diff, Dockerfile among them), built once per process and only loaded for a text holding a fenced code block; a language it does not know is plain text, and a highlighter that fails to load leaves the code plain (logged) rather than the page broken. Its two themes come as CSS variables, and the page's theme picks one set: GitHub's high-contrast light theme and its default dark one, the pair that keeps every token at 4.5:1 on the site's code background (the plain light theme falls to 3.2:1, found by the E2E suite's accessibility check).

Headings get ids (rehype-slug) prefixed by their page and language, as footnotes do: the other language's copy of a page stays mounted ([ADR-0003](0003-transitions.md)), and two copies never share an id.

### Safe by construction, checked by a corpus

Raw HTML in the source is dropped (`skipHtml`); links keep https, mailto and same-site URLs only; images come from the library only; directives are whitelisted. `rehype-sanitize`, planned at first, is not needed: React builds every element from the syntax tree, and the only attributes besides links and images are the heading ids rehype-slug derives from the text, and Shiki's class and colour variables (allowed by `style-src 'unsafe-inline'`, ADR-0002). A unit test runs a corpus from OWASP's XSS cheat sheet through the renderer (scripts, event handlers, `javascript:`, `vbscript:` and `data:` links, entity-encoded schemes, SVG, iframes, a code fence's language, directive attributes) and checks that no script, handler or unsafe URL comes out; the E2E suite publishes a project whose technical text holds such Markdown and checks that nothing ran.

## Alternatives considered

- **MDX**: components in texts, but stored code the site would execute.
- **HTML rendered at save time** (`body_html`, `render_version`): the fastest read, but a second renderer, and every text to re-render when an image's description or the renderer changes.
- **`rehype-raw` with `rehype-sanitize`**: raw HTML allowed and then cleaned, a larger surface for nothing the directives do not cover.

## Consequences

- The highlighter is built on first use in each function instance, then reused.
- The admin's preview loads the renderer and the highlighter on its first use only, and falls back to plain code, or to a message, when either fails to load.
- Migration `0006_drop_posts` removes the blog's tables and types, its redirects and its home tile; it applies whether `0005_posts` reached the database before or runs in the same batch. It runs after the deployment that removes the blog: that code ignores the rows it deletes.
