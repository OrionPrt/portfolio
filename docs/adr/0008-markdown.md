# ADR-0008 — Posts and stored Markdown

- **Status:** Accepted; P7a implemented, P7b (feeds, Open Graph images, scheduled publication, CodeMirror) to come
- **Date:** 2026-10-30
- **Phase:** P7

## Context

The blog publishes articles and write-ups, written in the admin and stored in the database, like every other text of the site. A technical post needs code blocks that read well, asides (a note, a warning, a solution folded away), a table of contents and a reading time. A write-up must not reveal the solution of a challenge still live. The site already renders stored Markdown for projects, experiences and the about page ([ADR-0007](0007-admin.md)); the CSP is strict ([ADR-0002](0002-csp.md)).

## Decisions

### Markdown with directives, never MDX

Posts are GFM Markdown with three directives, `:::note`, `:::warning` and `:::details` (`remark-directive`). MDX was ruled out: MDX stored in a database is code the site would run. A callout is named in the language of its text, not the page's: an English post read on the French blog says "Warning". Any other directive reads as the text it was written as ("Raison:valeur" stays as typed), and a directive's attributes (`{.class #id style=… onclick=…}`) are dropped: nothing an author writes becomes an attribute of the page.

### One renderer, on demand, cached

Every stored Markdown goes through the same component (`src/components/content/markdown.tsx`), now with the directives, heading ids and code colours; the admin's preview uses it too. Pages render it when they are rendered, inside their cached reads and pages, rather than storing HTML at save time as first planned (decided by the user on 2026-10-29): there is a single engine, and an image of the library or its description changes everywhere at once without re-rendering posts. Shiki colours the code with its JavaScript regex engine (no WebAssembly), the plan's languages and a few common ones, built once per process and only loaded for a text holding a fenced code block; a language it does not know is plain text, and a highlighter that fails to load leaves the code plain (logged) rather than the page broken. The plan's languages were joined by those of web write-ups: PHP, HTML, HTTP, diff and Dockerfile. Its two themes come as CSS variables, and the page's theme picks one set: GitHub's high-contrast light theme and its default dark one, the pair that keeps every token at 4.5:1 on the site's code background (the plain light theme falls to 3.2:1, found by the E2E suite's accessibility check).

### Safe by construction, checked by a corpus

Raw HTML in the source is dropped (`skipHtml`); links keep https, mailto and same-site URLs only; images come from the library only; directives are whitelisted. `rehype-sanitize`, planned at first, is not needed: React builds every element from the syntax tree, and the only attributes besides links and images are the heading ids rehype-slug derives from the text, and Shiki's class and colour variables (allowed by `style-src 'unsafe-inline'`, ADR-0002). A unit test runs a corpus from OWASP's XSS cheat sheet through the renderer (scripts, event handlers, `javascript:`, `vbscript:` and `data:` links, entity-encoded schemes, SVG, iframes, a code fence's language, directive attributes) and checks that no script, handler or unsafe URL comes out; the E2E suite publishes such a post and checks that nothing ran.

### A post in one language, or both

A post has the languages its translations give it, none required (decided on 2026-10-29): a write-up may exist in English only. Each language that is filled in has a title, an excerpt and a body. The blog of each language lists every published post, in its language where it has one, and says when it only exists in the other (`lang` set on its text). The admin flags no "translation missing" for posts.

### Classified by the skills of the catalog

Posts link to the catalog's skills, like projects and experiences, with their own order: the site keeps one vocabulary. A post is an article or a write-up; a write-up names its platform (Hack The Box, Root Me, TryHackMe, a CTF) and its difficulty. The admin's form shows those fields for a write-up only.

### A write-up of a live challenge stays unpublished

A published write-up needs its challenge's retirement date, or a box ticked when the platform allows write-ups of live challenges. Zod reports it on the field, and a CHECK constraint refuses it in the database. A retirement date still to come keeps the write-up off the site until that day, like a publication day (found in review): it can be written and published ahead, and appears once the challenge retires; the admin's list shows that day.

### Published on a day

A post is published on a day (`published_on`, today in Paris when left empty); a day still to come keeps it out of the site, Paris's day by the database's clock, so the admin and the site agree on what "today" is. Public reads are cached for hours, so such a post appears when its list's cache expires or a save expires it; the daily cron of P7b will expire it on its day.

### Its own collection of slugs

Posts are a third collection of the slug registry: the proxy answers 404 for an unknown post and 301 for a renamed one, the sitemap lists them, and a published post's rename leaves a redirect, as for projects.

## Alternatives considered

- **MDX**: components in posts, but stored code the site would execute.
- **HTML rendered at save time** (`body_html`, `render_version`): the fastest read, but a second renderer beside the projects', and every post to re-render when an image's description or the renderer changes.
- **`rehype-raw` with `rehype-sanitize`**: raw HTML allowed and then cleaned, a larger surface for nothing the directives do not cover.
- **French required, English falling back**: the rule of the rest of the site, but a write-up in English only would show as a French page.
- **Free tags**: more freedom, a second vocabulary to keep by hand.

## Consequences

- The highlighter is built on first use in each function instance, then reused; code blocks of projects and experiences are coloured too.
- Migration `0005` (posts, their translations and skills, the `posts` collection of redirects) must be applied before deploying, then `pnpm db:roles` run again.
- The admin's preview loads the renderer and the highlighter on its first use only.
- A post scheduled for a day shows within hours of it until P7b's cron expires the lists on that day.
