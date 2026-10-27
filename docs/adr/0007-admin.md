# ADR-0007 — Admin back office

- **Status:** Accepted; implemented slice by slice (P6a and P6b1 done, P6b2–P6d to come)
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

Implemented for the profile, the social links and the skills (P6b1); projects, experiences, education and certifications follow the same pattern (P6b2).

- **One save path.** `saveContent` (`src/features/admin/save-content.ts`) runs every content form: the session first, then the input against the same Zod schemas as the seed, the write, an audit event (`content.created` or `content.updated`), and `updateTag` on the caches the change makes stale (`src/features/admin/content-tags.ts`: the entity's list, and each page it has, both slugs on a rename). `updateTag` makes the next request wait for fresh data, so a change shows on the site at once.
- **Both languages, French required.** French is required, as in the seed; English left entirely blank is not stored, and the site falls back to French with the right `lang` attribute (decided on 2026-10-26). Each bilingual field shows both languages side by side, each control in its language, and flags a translation still to write as the text is typed.
- **Writes, statement by statement.** Neon over HTTP has no interactive transaction: a save writes the row, then each translation, then the links, each idempotent, so a save cut short is completed by saving again (the form keeps its values on any failure). Deletions are a single statement (below).
- **Deletion.** Permanent after an explicit confirmation. One statement deletes the row and writes its snapshot to the audit log (`content.deleted`): the row, and the rows its cascade deletes (translations, links to skills), read before the cascade runs (`deleteWithSnapshot`).
- **Ordering.** Move up and move down buttons; at an end the button stays, disabled but focusable, so focus is never dropped. The order is renumbered and audited (`content.reordered`).
- **Forms.** The server gets the fields only: the form keeps what it sent, and after a refusal every field starts again from it (an unticked box stays unticked). Once saved, the page refreshes and the fields start from the stored values. Fields are mounted afresh with each outcome, since React applies a select's `defaultValue` at mount only. Zod's issues come back by field (`fr.headline`, `slug`…), a taken slug or link kind on its own field, and the form names them in French, focusing the first (once: a hidden page shown again does not take focus back). Leaving with unsaved changes asks first, once however many forms the page holds (the browser's prompt on reload or close, a confirmation before following a link; back and forward are not caught). Field ids come from `useId`: pages visited earlier stay mounted, hidden. Markdown fields have a preview drawn by the public site's own renderer, loaded on first use. Zod stays out of the browser (its probe of `new Function` would trip the CSP): limits live in a Zod-free module.
- **Outcomes said aloud.** A save is announced in the form's live region; a move in the list's; a deletion, whose row or page goes away, through a polite region the frame keeps (`announce`), focus moving to the page, or back to the list from the entry's own page.
- **Request size.** Server actions accept up to 512 KB (two Markdown texts of 50,000 characters at most); Zod bounds every field. Skills stop at 200, the most the public read shows.

### Decided for the next slices

- **Renamed slugs**: renaming a published project or experience adds a permanent (301) redirect from the old slug, read by the proxy (P6b).
- **Images**: uploaded through the server, at most 4 MB, checked by magic bytes before anything is stored, then re-encoded with sharp (WebP, metadata stripped), which also defeats polyglot files. Stored in Vercel Blob in production, on the local disk in development and E2E. A route handler takes the upload, so the 64 KB body limit of server actions stays for every other form. Images serve project covers, company and school logos, and Markdown content; each carries a French and an English alternative text (P6c).
- **Ordering** (bento, lists): move up / move down buttons, accessible as they are, rather than drag and drop (P6d).
- **Database roles**: the site runs with a role limited to data changes (no DDL); the owner's URL only serves migrations and the seed (P6d).

## Alternatives considered

- **Direct browser-to-Blob uploads** (`@vercel/blob/client`): larger files and no function involved, but a file reaches storage before it is checked, and the completion callback cannot reach a local machine.
- **Drag and drop (dnd-kit)**: nicer with a mouse, but a client dependency and more to test, for about ten tiles.
- **Marking a message read when its page renders**: simpler, but a prefetch would mark it read unseen.
- **Soft deletion of messages**: nothing lost by mistake, but a deleted message would keep its personal data.

## Consequences

- Every new admin page goes in the proxy's route table, or it answers 404; the unit test and the E2E sweep catch a missing entry.
- Each content type adds an admin repository (read for editing, save, order), thin actions on `saveContent`, `moveContent` and `deleteContent`, and its cache tags in `content-tags.ts`.
- The navigation reads the unread count when the frame renders (one `count(*)` on an indexed column, once per request); it follows the actions, which refresh the page, not plain navigations between pages.
- The frame checks the session too (`requireAdmin`, cached per request), so nothing it shows reaches anyone else, whatever page renders inside it.
- Server-rendered admin pages are dynamic: Next.js sends them with `Cache-Control: no-store` (checked by the E2E suite).
- P6c adds a route handler under `/api/admin/`, listed in `src/lib/non-localized-routes.ts`, and the Blob host to the CSP's `img-src`.
