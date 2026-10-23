# ADR-0004 — Data layer

- **Status:** Accepted
- **Date:** 2026-10-23
- **Phase:** P2

## Context

Content (profile, projects, experiences, skills, education, certifications, bento layout) lives in PostgreSQL on Neon and is read by server components on Vercel. Three constraints shape the layer:

- Public pages render dynamically, because the CSP nonce is per request (ADR-0002). Reads must therefore be cached, or every visit would query the database.
- Tests and CI must exercise real PostgreSQL behavior (constraints, enums, transactions) without a network or a Docker service.
- Until the admin exists (P6), content arrives through a seed run from a developer machine.

## Decisions

### Drizzle, with committed SQL migrations

The schema is written with Drizzle (`src/db/schema/`, one file per domain) and `drizzle-kit generate` turns it into SQL files committed under `drizzle/`. Drizzle stays close to SQL, needs no generated client or binary, and runs the same schema on the three drivers below. CI regenerates the migrations and fails if `drizzle/` changes, so a schema edit cannot ship without its migration.

### One schema, three drivers

| Where                             | Driver                                           | Why                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App (Vercel)                      | `drizzle-orm/neon-http`                          | One HTTP round trip per query, no connection to keep alive across serverless invocations. Reads need no transaction.                                   |
| Scripts (`db:migrate`, `db:seed`) | `drizzle-orm/neon-serverless` (WebSocket `Pool`) | Migrations and the seed need transactions, which the HTTP driver does not support. Node 22+ ships the WebSocket.                                       |
| Tests                             | `drizzle-orm/pglite`                             | PostgreSQL compiled to WebAssembly, migrated with the real files in `drizzle/`: same SQL, constraints and enums, in memory, without network or Docker. |

Repositories depend on the driver-agnostic `Database` type (`src/db/types.ts`), never on a driver.

### Repositories return results, and every list is bounded

Each domain exposes a factory, `createProjectRepository(db)` and so on, injected with the database in tests. Reads:

- return a `Result`: a database failure is logged once with its cause by `runQuery`, and callers only see `DB_UNAVAILABLE`;
- always carry a `LIMIT`, from `toPage` (at most 50 rows, offset capped) or from a named upper bound in `src/db/limits.ts`, nested lists included;
- pick the requested translation, else the default locale's, and flag the fallback with `isFallback` so the page can set the right `lang`;
- treat a published row without any translation as unpublished, in SQL: lists, slug listings and lookups agree, so the sitemap never lists a page that would 404, and a page of results is never cut short;
- break every ordering tie on the slug, so the order never depends on the physical row order.

### Integrity is enforced twice

The database rejects what must never be stored, with CHECK constraints: slug format and length (80); `https://` links with a host and no whitespace; `mailto:` for the email link and `https://` for every other social link; an end date only after a start date; a single profile row. The Zod input schemas (`src/features/content/schemas.ts`) apply the same patterns, so a value they accept is never refused by the database, plus text lengths, and give readable errors. They also normalize links before checking them and refuse links carrying credentials, which only serve to disguise a host. They guard the seed now and will guard the admin forms in P6. Closed lists (domains, statuses, tile kinds…) live in `src/features/content/vocabulary.ts`, a plain module that both the Postgres enums and the schemas read, so the schemas can run in the browser without bundling Drizzle.

### Cached reads keep successes for hours and failures for seconds

Pages read through `src/features/*/queries.ts`: `'use cache'` functions tagged with the constants of `src/lib/cache-tags.ts` (`projects`, `project:<slug>`, `skills`…). Each calls `cacheLife("hours")` when the read succeeds and `cacheLife("seconds")` when it fails, the conditional pattern of the Next.js documentation. An outage is then kept for seconds only, and a short-lived entry is also excluded from prerenders.

The alternative, throwing inside the cached function so that nothing is stored and catching outside, was rejected. In production an error crossing the cache boundary loses its class and message, and a catch-all there could swallow errors Next.js relies on: `unstable_rethrow` does not cover the "use cache" timeout error.

A slug that comes from the URL is first checked for its format, then looked up in the cached list of published slugs (one entry, tagged `projects` or `experiences`). Only a slug in that list reaches the per-slug cached read. Requests for made-up slugs therefore cost no query and create no cache entry: the cache only ever holds real rows, and holds no "not found" that could outlive a later publication.

On the production client (`src/db/client.ts`), every query gets its own 8-second timeout, through the driver's `fetchFunction`. A missing `DATABASE_URL`, or a driver that cannot be set up, is logged and read as `DB_UNAVAILABLE`, so a page degrades instead of crashing. `DATABASE_URL` must also be a URL the Neon driver can parse: on failure, the driver quotes the whole connection string, password included, in its error.

### The seed validates first, upserts in one transaction, and invents nothing

`scripts/seed/content.ts` holds typed content. `parseSeedContent` validates it before any connection is opened, including duplicate slugs and references to unknown skills. `seedDatabase` then upserts by slug (or kind) in a single transaction. It never deletes, and only replaces the skill links of the entities it seeds, to follow the order given. Text that is not known yet is marked `[À COMPLÉTER]`. Entries that need unknown facts, such as dates and issuers, are left out, with a template in comments. `education` gained a `slug` so that it can be upserted like the other entities.

## Consequences

- Vercel's default cache handler keeps entries in memory, per instance: a cold instance queries the database again. This is acceptable at a portfolio's traffic, and `'use cache: remote'` remains available if it is not.
- Until the admin revalidates tags on save (P6), seeded content appears within the hour, or at the next deploy.
- Running the seed after the admin exists would overwrite edits made there. The seed is for bootstrapping and development. It never deletes: a slug renamed in the content leaves the old row published until it is removed in the database. It warns about `[À COMPLÉTER]` text left in the content, which would show on the site.
- `updated_at` means "last written", not "last edited": a re-seed bumps it. It must not feed a sitemap `lastmod` as is.
- A new enum value cannot be used in the migration run that adds it (PostgreSQL refuses it inside the same transaction), and a value cannot be removed without a hand-written type swap. Run `pnpm db:migrate` before deploying code that uses a new value.
- PGlite runs PostgreSQL 18.6, the same version as the Neon project (checked on 2026-10-23). Both must move together: a feature that only one of them supports would pass the tests and fail the migration.
- The app and the scripts share one `DATABASE_URL`, the owner role. Once the admin writes (P6), the public pages should read through a role limited to `SELECT`, and the owner URL should only serve migrations and the seed.
- Migrations are not applied to Neon by CI. PGlite applies them on every test run, and `pnpm db:migrate` applies them to Neon, by hand until a deploy step does it.
- In P3, pages read the database at request time. A build without `DATABASE_URL`, as in CI, gets `DB_UNAVAILABLE`, which is short-lived and so never baked into the prerender. Pages must render a degraded state for it.
