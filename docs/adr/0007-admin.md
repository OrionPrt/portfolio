# ADR-0007 — Admin back office

- **Status:** Accepted; implemented slice by slice (P6a to P6d)
- **Date:** 2026-10-26
- **Phase:** P6

## Context

The admin of [ADR-0006](0006-auth.md) signs the owner in; P6 makes the site editable without touching code: the contact inbox, every content type in both languages, images, the bento layout. It must:

- treat every admin action as the public endpoint it is, whatever page shows its form;
- keep personal data (contact messages) out of logs and of the audit trail once deleted;
- show a change on the public site right after it is saved;
- stay within Vercel's function limits and the strict CSP of [ADR-0002](0002-csp.md).

## Decisions

### Delivered in slices

P6 is delivered in four slices, each tested, reviewed and committed on its own (decided on 2026-10-26): **P6a** the shell and the inbox, **P6b** the content CRUD, **P6c** media, **P6d** the bento, the dashboard and the database roles.

### One runner for every admin action

`runAdmin` (`src/features/admin/run-admin.ts`) wraps each action: a full session first (`requireAdmin`, else a redirect to the login), then the configuration and the origin (`checkedRequest`, shared with the auth actions), then the work against the database. Any failure reads as "unavailable" and is logged. The audit writer it hands over fills in the actor, the network's keyed hash and the user agent. Input is parsed with Zod inside each action, after the session check: a malformed id reads like an unknown one.

### One frame for the signed-in pages

Next.js keeps pages already visited mounted, hidden (`<Activity>`, Cache Components). A frame rendered by each page therefore repeated its `id`s (`#admin-main` two and three times after two navigations: the skip link and `aria-labelledby` could point into a hidden page), and focus fell back to the document after each navigation. The signed-in pages share one layout, in the route group `src/app/admin/(console)`: one sidebar, one main region, and `AdminRouteFocus`, which moves focus to that region after a navigation, query included (a page of the inbox). The sign-in steps have a layout and an `id` of their own; ids that pages repeat carry the page's key (`message-subject-<id>`).

### Admin routes stay an allowlist

The proxy routes only the admin's known pages. Pages with a dynamic segment are listed as patterns (`/admin/messages/[id]`, where `[id]` must be a lowercase UUID); a test compares the table with `src/app/admin`, and the E2E suite derives its "every page needs a full session" sweep from the same table.

### The inbox handles personal data as such

- Messages are rendered as React text: no HTML, no automatic links. The reply is a `mailto:` link built from the stored, validated address.
- Opening an unread message marks it read from the browser, once the page is shown (a client effect calls a server action). A GET or a prefetch never changes anything.
- Deletion is permanent, after an explicit confirmation (a modal `<dialog>`, focus on Cancel, a fresh form at each opening). One SQL statement deletes the message and writes the audit row, the message's id only, never its content: if the audit row is refused, nothing is deleted.
- Repository failures are logged without query values (`hasPersonalData`).

### Content is edited in both languages, saved as the seed saves it

Implemented for the profile, the social links and the skills (P6b1), the projects and the experiences (P6b2a), then education and certifications (P6b2b).

- **One save path.** `saveContent` (`src/features/admin/save-content.ts`) runs every content form: the session first, then the input against the same Zod schemas as the seed, the write, an audit event (`content.created` or `content.updated`), and `updateTag` on the caches the change makes stale (`src/features/admin/content-tags.ts`: the entity's list, and each page it has, both slugs on a rename). `updateTag` makes the next request wait for fresh data, so a change shows on the site at once.
- **Both languages, French required.** French is required, as in the seed; English left entirely blank is not stored, and the site falls back to French with the right `lang` attribute (decided on 2026-10-26). Each bilingual field shows both languages side by side, each control in its language, and flags a translation still to write as the text is typed.
- **Writes, in one statement where it counts.** Neon over HTTP has no interactive transaction. A project or an experience is saved in a single statement: its row, its translations, its links to skills and the redirects it leaves run as data-modifying CTEs of one statement (`alongside`, `src/db/one-statement.ts`), so a save happens whole or not at all; a new entry's id is drawn by the app, so its translations and links are written alongside it. The writes of one statement share a snapshot: each touches rows the others leave alone, and the translations a save drops come back from its final `delete … returning` for the audit log. The profile and the links, written statement by statement in P6b1, stay idempotent: saving again completes a save cut short (the form keeps its values on any failure). Deletions and reorderings are single statements too.
- **Deletion.** Permanent after an explicit confirmation. One statement deletes the row and writes its snapshot to the audit log (`content.deleted`): the row, and the rows its cascade deletes (translations, links to skills), read before the cascade runs (`deleteWithSnapshot`).
- **Ordering.** Move up and move down buttons; at an end the button stays, disabled but focusable, so focus is never dropped, and the button pressed keeps it when React moves its row. The order is renumbered in one statement and audited (`content.reordered`). Skills are ordered within their domain, projects within their group (featured first, as the site shows them); experiences have no order to set, the site sorts them by date.
- **Education and certifications.** Neither has a page: their slug is only the seed's natural key, so the admin never sees it. It is drawn from the name at creation (accents dropped, numbered when taken: `oscp`, `oscp-2`) and kept through any rename. Both are public as soon as saved, with no draft (decided on 2026-10-28): short entries, written in one go. They stop at 50 each, where the public lists stop; the list flags an expired certification by the database's date.
- **Linked skills.** A project or an experience links up to 30 skills, in the order its badges show (decided on 2026-10-27): picked from the catalog by domain, then moved or removed. Each change is said aloud and counts as unsaved; the focus stays on the control used, or goes to the closest one left. Hidden fields carry the order; a slug no skill holds any more is passed over.
- **Forms.** The server gets the fields only: the form keeps what it sent, and after a refusal every field starts again from it (an unticked box stays unticked). Once saved, the page refreshes and the fields start from the stored values. Fields are mounted afresh with each outcome, since React applies a select's `defaultValue` at mount only. Zod's issues come back by field (`fr.headline`, `slug`…), a taken slug or link kind on its own field, and the form names them in French, focusing the first (once: a hidden page shown again does not take focus back). Leaving with unsaved changes asks first, once however many forms the page holds (the browser's prompt on reload or close, a confirmation before following a link; back and forward are not caught). Field ids come from `useId`: pages visited earlier stay mounted, hidden. Markdown fields have a preview drawn by the public site's own renderer, loaded on first use. Zod stays out of the browser (its probe of `new Function` would trip the CSP): limits live in a Zod-free module.
- **Outcomes said aloud.** A save is announced in the form's live region; a move in the list's; a deletion, whose row or page goes away, through a polite region the frame keeps (`announce`), focus moving to the page, or back to the list from the entry's own page.
- **Request size.** Server actions accept up to 512 KB (two Markdown texts of 50,000 characters at most); Zod bounds every field. Skills stop at 200, the most the public read shows; projects and experiences at 1,000 each, where the slug listings stop.

### An image library

Implemented in P6c (decided on 2026-10-26, 2026-10-28 and 2026-10-29).

- **Upload, checked before anything is decoded.** A route handler takes the file (`POST /api/admin/media`), so the server actions' body limit stays small for every other form; it answers 401 rather than redirect a fetch to the login. A body without a length, or over 4 MB plus the form's wrapping, is refused unread; the session and the origin are checked before the body is parsed. The format comes from the first bytes (JPEG, PNG, WebP; SVG, GIF and anything else refused), and the header's size from sharp before any decoding (40 megapixels at most: a decompression bomb is refused undecoded).
- **Re-encoded, three widths.** sharp turns the image upright, then writes WebP at about 480, 960 and 1,600 pixels wide (never wider than the source), without its metadata (location, camera), which also defeats polyglot files. The widths are made at upload and served in a `srcset` (`MediaImage`): no image optimizer runs, so no Vercel quota is spent, and each image knows which widths it has (decided on 2026-10-28). The same file is stored once (SHA-256), and the library stops at 200 images.
- **Stored on Blob's own domain.** Production stores the files in Vercel Blob, public, at `media/<id>/<width>.webp`, never overwritten (a new upload gets a new id), so they are cached for a year; the CSP's `img-src` allows that domain, for images only. Without Blob's token, a production build refuses uploads rather than write to a disk that may not last, on Vercel or elsewhere; development and E2E (where development defaults are allowed) write under `.media/`, served by a route of the app whose paths follow a strict pattern. The CSP admits any store's subdomain: images only, and the exact host is only known once a store exists (to tighten in the final CSP review, P11).
- **Described in both languages.** Each image carries an alternative text in French and in English, both required (an image has no translation to fall back on). Pages use it where the image says something (a project's cover on its page); on cards, tiles and beside a company or certification name, the image adorns text that already says it, and is silent (`alt=""`).
- **In the Markdown, the library's images only.** A text names an image `![text](media:<id>)`, a title after it becoming its visible caption (`<figure>` and `<figcaption>`); the editor inserts one at the caret, its text taken from the library in the field's language, and the preview shows it. The page loads the images its text names (30 at most, cached under the `media` tag) and draws them at their stored widths; the text's own description comes first, the library's when it gives none. An image from elsewhere, or one the library no longer has, shows its description: no third party is fetched, and the CSP stays as it is (decided on 2026-10-29).
- **Kept while shown.** Projects have a cover, experiences and education a logo, certifications a badge (included on 2026-10-28; the education logo waits for the CV and the About page). A foreign key keeps an image while an entry shows it as its cover, logo or badge; a reference in a project's or an experience's technical text, or in the about text, keeps it too, found by its `media:<id>` in any language. Its page lists those entries, the texts said as such, and offers no deletion meanwhile. Deleted, its record goes with a snapshot in the audit log, then its files; files a failure leaves behind are logged (`media.cleanup_failed`). An alternative text edited expires every read showing an image (the `media` cache tag).

### Renamed slugs lead to the new ones

Implemented in P6b2a (decided on 2026-10-26 and 2026-10-27).

- **When.** Renaming a _published_ project or experience records a permanent redirect from its old slug (`slug_redirects`, per collection). A draft's slug is not public: renaming it records nothing, and a redirect from the slug it takes keeps working until it is published. Once published, an entry's slug is no longer an old one (its redirect goes).
- **Flat chains.** A to B then B to C leaves A to C and B to C; renamed back, an entry takes its old slug again. A redirect counts only while its target is published, so it never reveals a draft. Deleting an entry drops the redirects to it, in the deletion's statement.
- **Who answers.** The proxy answers 301 from its in-memory lists (published slugs and redirects, trusted a minute; a slug it does not know reloads them, or waits on the load their age just started, at most once a second, and never on a load that hangs; a slug published within a second of the last load answers 404 for that second). The 301 is kept an hour by the browser only (`Cache-Control: private`): a shared cache would go on answering it once the slug is taken again. Until the proxy's lists learn of a rename, the old address reaches the entry's page, which sends the browser on from the same lists, cached for the pages and expired by the save (`movedSlug`). The page is streamed, so Next.js can no longer set its status: the redirect is an instant meta refresh in a 200, which browsers follow at once and search engines read as permanent. A deleted entry's page likewise shows "not found" at once, the 404 status following once the lists reload.

### The hub's layout, edited whole

Implemented in P6d1 (decided on 2026-10-29).

- **One form, previewed before saving.** The tiles are listed in reading order, each moved with up / down buttons (rather than dragged: decided on 2026-10-26), sized, and shown or hidden; a miniature of the four-column grid follows every change before anything is saved. It places the tiles as the browser does (`grid-auto-flow: row dense`, `src/features/bento/placement.ts`), counts the rows, and warns once the hub takes more than the four a 1280×720 screen holds. One save writes the whole layout in one statement.
- **Rules the server enforces too.** Each tile offers the sizes its content fits (the featured project is never a single cell); the identity tile, which holds the page's h1, is always shown; the CV tile stays hidden and out of the editor until it exists (P9); the blog's tile went with the blog ([ADR-0008](0008-markdown.md)). The same rules (`src/features/bento/rules.ts`) drive the editor and the action's Zod schema.
- **A journey tile.** The certifications tile became "Parcours" (journey) on 2026-10-29: the most recent education (its logo, degree, school and years), then the latest certifications. It shows as soon as either exists; its stored kind stays `certifications`, so no migration renames it. Education had no other place on the site yet.
- **The preview shows what the site shows.** A tile with nothing to show (no featured project, no certification…) is left out of the hub whatever its setting; the editor says so beside it and leaves it out of the miniature. Both read it from one function (`tileContent`), the editor through the same cached queries as the hub.

### A dashboard of what is left to do

Implemented in P6d1 (decided on 2026-10-29). The dashboard lists, entry by entry and each linked to its form: unread messages, English translations missing or partial (measured as the lists measure them), drafts, text still holding the seed's `[À COMPLÉTER]` marker (any column, any language, found by casting each row to text), and entries without their cover, logo or badge. Beside them: the image library against its ceiling and the images nothing shows, and the place of the platforms' statistics (their collection arrives in P8). Below: the latest audit events, content ones naming what they changed. Each part reads on its own, so one failing read leaves the others shown.

### The site writes as a role limited to data

Implemented in P6d2 (decided on 2026-10-26 and 2026-10-29), described in [ADR-0004](0004-data-layer.md): the site and the admin commands connect as `portfolio_app`, which changes rows but not the schema, and only adds to the audit log; the owner's URL serves migrations, the seed and the roles script (`pnpm db:roles`) from a developer's machine.

## Alternatives considered

- **`next/image` with Vercel's optimizer**: one file stored and any width on demand, but each transformation counts against the Hobby plan's quota, and the result varies with the host.
- **Direct browser-to-Blob uploads** (`@vercel/blob/client`): larger files and no function involved, but a file reaches storage before it is checked, and the completion callback cannot reach a local machine.
- **Drag and drop (dnd-kit)**: nicer with a mouse, but a client dependency and more to test, for about ten tiles.
- **Marking a message read when its page renders**: simpler, but a prefetch would mark it read unseen.
- **Soft deletion of messages**: nothing lost by mistake, but a deleted message would keep its personal data.
- **Neon's WebSocket driver, for interactive transactions**: transactions as usual, but a second connection mode in serverless functions, for writes one statement covers.
- **Proxy lists refreshed every few seconds** instead of the page redirecting on its own: simpler, but a query per few seconds under traffic, and still a moment of 404 after each rename.

## Consequences

- Every new admin page goes in the proxy's route table, or it answers 404; the unit test and the E2E sweep catch a missing entry.
- Migration `0003` (the redirects table) must be applied before the code that reads it is deployed. It also tightens the social links' `mailto:` check (no `?` or `#`), which validates the stored rows.
- Each content type adds an admin repository (read for editing, save, order), thin actions on `saveContent`, `moveContent` and `deleteContent`, and its cache tags in `content-tags.ts`.
- The navigation reads the unread count when the frame renders (one `count(*)` on an indexed column, once per request); it follows the actions, which refresh the page, not plain navigations between pages.
- The frame checks the session too (`requireAdmin`, cached per request), so nothing it shows reaches anyone else, whatever page renders inside it.
- Server-rendered admin pages are dynamic: Next.js sends them with `Cache-Control: no-store` (checked by the E2E suite).
- The upload route and the disk storage's route are listed in `src/lib/non-localized-routes.ts` (a catch-all path matches what follows it); the CSP's `img-src` allows Vercel Blob's domain.
- Migration `0004` (the image library) must be applied before the code that reads it is deployed, and Vercel Blob connected to the project (`docs/deploy.md`).
