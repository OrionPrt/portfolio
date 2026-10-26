# ADR-0007 — Admin back office

- **Status:** Accepted; implemented slice by slice (P6a done, P6b–P6d to come)
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

### Decided for the next slices

- **Revalidation**: saving calls `updateTag` (read-your-own-writes) for the list tag and the entity's tag, both slugs on a rename (P6b).
- **Deletion of content**: permanent after confirmation, with a snapshot of the deleted row in the audit log, so it can be restored by hand (P6b).
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
- The navigation reads the unread count when the frame renders (one `count(*)` on an indexed column, once per request); it follows the actions, which refresh the page, not plain navigations between pages.
- The frame checks the session too (`requireAdmin`, cached per request), so nothing it shows reaches anyone else, whatever page renders inside it.
- Server-rendered admin pages are dynamic: Next.js sends them with `Cache-Control: no-store` (checked by the E2E suite).
- P6c adds a route handler under `/api/admin/`, listed in `src/lib/non-localized-routes.ts`, and the Blob host to the CSP's `img-src`.
