# Deployment

The site runs on Vercel (Hobby plan) and reads PostgreSQL on Neon. Every push to `main` deploys to production, and every pull request gets a preview.

## First deployment

1. **Database.** Apply the migrations and the content to the Neon database, from a machine whose `.env.local` holds its `DATABASE_URL`:

   ```bash
   pnpm db:migrate
   pnpm db:seed   # warns about "[À COMPLÉTER]" text left in scripts/seed/content.ts
   ```

2. **Project.** In Vercel, import the GitHub repository. Vercel detects Next.js and pnpm (pinned in `package.json`). In _Settings → Build and Deployment_, set the Node.js version to 24.x.
3. **Environment variables** (_Settings → Environment Variables_):

   | Variable               | Environments          | Value                                                                                     |
   | ---------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
   | `DATABASE_URL`         | Production            | The Neon connection string (pooled) of the main branch                                    |
   | `DATABASE_URL`         | Preview               | A Neon branch made for previews, so a preview never reads production                      |
   | `NEXT_PUBLIC_SITE_URL` | Production (optional) | Only once the final domain is live (P12); until then canonical URLs use the Vercel domain |

   `NODE_ENV`, `VERCEL_ENV` and `VERCEL_PROJECT_PRODUCTION_URL` are set by Vercel. The build validates every variable and stops on an invalid one.

4. **Vercel toolbar.** Disable it (_Settings → General → Vercel Toolbar_) for previews and production. The enforced Content Security Policy would block it, and the policy is kept identical in every environment ([ADR-0002](adr/0002-csp.md)).
5. **Analytics.** Enable Web Analytics and Speed Insights in the project. The site already loads them, without cookies.

## After a deployment

- `https://<project>.vercel.app/fr` shows the hub, and an unknown path such as `/fr/inconnu` answers `404`.
- The response headers carry `Content-Security-Policy` (enforced) and `Reporting-Endpoints`.
- The runtime logs show no `csp.violation` warnings, and no `db.not_configured` or `DB_UNAVAILABLE` errors.

## Content updates

Until the admin exists (P6), content changes go through `scripts/seed/content.ts` and `pnpm db:seed`. Cached reads expire within the hour, or at the next deployment. The seed never deletes: a renamed slug leaves the old row in the database.

## Schema changes

Run `pnpm db:generate`, commit the new migration, then `pnpm db:migrate` against Neon before deploying code that depends on it. A migration already applied is never edited ([ADR-0004](adr/0004-data-layer.md)).
