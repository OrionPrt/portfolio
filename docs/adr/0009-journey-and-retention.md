# ADR-0009 — Journey page, platforms entered by hand, and a daily purge

- **Status:** Accepted
- **Date:** 2026-10-30
- **Phase:** P8

## Context

The site shows certifications and education on the home's journey tile ([ADR-0007](0007-admin.md)), but had no page listing them, and the platforms tile only linked to Hack The Box, Root Me and TryHackMe profiles. The plan was to fetch each platform's rank and points every day: Hack The Box and Root Me have APIs behind a personal token, TryHackMe has no documented one for a profile. The contact form promises to keep messages 12 months ([ADR-0005](0005-contact-form.md)), and expired sessions and sign-in counts were left for a daily job ([ADR-0006](0006-auth.md)).

## Decisions

### A journey page

`/fr/parcours`, `/en/journey`: education, certifications and platforms, each section shown once it has something. The journey tile opens it and morphs into it, as the other tiles do ([ADR-0003](0003-transitions.md)). A certification past its expiry day stays listed, marked as expired; the database's clock decides, inside the cached read.

### Platforms entered by hand, never fetched

Decided by the user on 2026-10-30: no adapter, token or call to a platform. Platforms are a free list in the admin (`/admin/platforms`): a name, an optional https link to the profile, a rank and points as the platform shows them, the day they were read, an order. Names and ranks are proper nouns, never translated. The tile and the page show nothing while the list is empty. The `hackthebox`, `rootme` and `tryhackme` kinds of social links became platforms: one place for a profile. Migration `0007_platforms` moves such a link only if it was shown; a hidden one is dropped rather than made public (found in review).

### A daily purge

Vercel calls `/api/cron/daily` once a day (`vercel.json`, 03:00 UTC; the Hobby plan runs it within that hour) with `Authorization: Bearer <CRON_SECRET>`, compared in constant time. Without the variable the route logs `cron.not_configured` and answers `401`, as to a wrong token: a caller learns nothing of the setup, and refused calls are not logged. It deletes:

- contact messages over 12 months old;
- sessions past their end;
- sign-in counts whose longest window has passed with no lock running, which are worth nothing (a count starts over after its window);
- audit log entries over 12 months old.

Each purge runs on its own: one failing leaves the others done, and the route answers 500 so the run shows as failed. A run that removed anything writes `retention.purged` to the audit log with its counts, so the log's own deletions leave a durable trace. The route reads its request first: a `GET` that reads none is prerendered at build under Cache Components.

The site's role may only add to the audit log ([ADR-0004](0004-data-layer.md)). Rather than granting it `DELETE`, migration `0007` adds `purge_audit_logs()`, a `SECURITY DEFINER` function owned by the owner, with a fixed search path and a fixed cutoff, that removes entries over 12 months old and nothing else. `PUBLIC` cannot run it; `pnpm db:roles` lets the site's role run it, and only that function: it also stops PostgreSQL from letting everyone run the functions the owner creates later, and refuses to finish if the site could run another function with its owner's rights.

## Alternatives considered

- **Fetching the platforms daily**: always fresh figures, but personal tokens kept on Vercel, unofficial endpoints that change, terms of use to respect, and a TryHackMe adapter built on a session cookie. Entering them by hand costs a minute when they change.
- **`DELETE` on the audit log for the site's role**: simpler, but anyone running code as the site could erase recent entries, the ones that matter after an intrusion.
- **A purge from the admin**: a button nobody presses; retention promised to visitors must not depend on it.

## Consequences

- Migration `0007` must be applied, then `pnpm db:roles` run, before deploying the code that reads `platforms`; `CRON_SECRET` must be set on Vercel.
- Figures shown are as fresh as the last edit: each platform says the day it was read, and the tile the oldest of those it shows.
- The audit log keeps a year of history at most.
