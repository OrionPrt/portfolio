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

## Contact form

Without the variables below, production shows the contact page with a message pointing to email and LinkedIn instead of the form, and logs `contact.not_configured` on any submission ([ADR-0005](adr/0005-contact-form.md)).

1. **Database.** Apply the `contact_messages` migration to Neon, from a machine whose `.env.local` holds its `DATABASE_URL`: `pnpm db:migrate`. Do it before deploying, or storing a message fails.
2. **Cloudflare Turnstile.** In a free Cloudflare account, _Turnstile → Add widget_: any name, hostname `orion-prieto.vercel.app` (add the final domain at P12), mode _Managed_. Keep the **site key** and the **secret key**.
3. **Upstash Redis.** In Vercel, _Storage → Create Database → Upstash for Redis_ (free plan, in the region of the functions), connected to this project for Production. The integration adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`): the site reads either naming.
4. **Resend.** Create the account with the address that receives the messages (`prieto.orion@gmail.com`): until a domain is verified (P12), Resend only delivers to the account's own address, from `onboarding@resend.dev`. Then _API Keys → Create API Key_ with _Sending access_ only.
5. **Salt.** Generate one with `openssl rand -base64 48`. Keep it stable: a new salt resets every sender's count, and older hashes no longer match.
6. **Variables** (_Settings → Environment Variables_, Production; mark the secrets _Sensitive_):

   | Variable               | Value                                                   |
   | ---------------------- | ------------------------------------------------------- |
   | `TURNSTILE_SITE_KEY`   | The widget's site key                                   |
   | `TURNSTILE_SECRET_KEY` | The widget's secret key (sensitive)                     |
   | `IP_HASH_SALT`         | The salt from step 5 (sensitive)                        |
   | `RESEND_API_KEY`       | The Resend key (sensitive)                              |
   | `CONTACT_TO_EMAIL`     | `prieto.orion@gmail.com`                                |
   | `CONTACT_FROM_EMAIL`   | Optional: `Portfolio <onboarding@resend.dev>` until P12 |

   Redeploy afterwards: variables only apply to new deployments. Without `RESEND_API_KEY` or `CONTACT_TO_EMAIL`, messages are still stored, but nobody is notified.

7. **Previews.** Without these variables for Preview, a preview's contact page shows the "not available" message, which is expected. To try the form on a preview, set them for Preview too, with a widget whose hostnames include the preview's. Cloudflare's test keys are refused on Vercel: they pass any token.

## After a deployment

- `https://<project>.vercel.app/fr` shows the hub, and an unknown path such as `/fr/inconnu` answers `404`.
- The response headers carry `Content-Security-Policy` (enforced) and `Reporting-Endpoints`.
- The runtime logs show no `csp.violation` warnings, and no `db.not_configured` or `DB_UNAVAILABLE` errors.
- `/fr/contact` shows the form and the Turnstile widget. A test message appears in `contact_messages` and arrives by email, and the logs show no `contact.not_configured`, `contact.turnstile_*` or `contact.mail_*` entries.

## Content updates

Until the admin exists (P6), content changes go through `scripts/seed/content.ts` and `pnpm db:seed`. Cached reads expire within the hour, or at the next deployment. The seed never deletes: a renamed slug leaves the old row in the database.

## Schema changes

Run `pnpm db:generate`, commit the new migration, then `pnpm db:migrate` against Neon before deploying code that depends on it. A migration already applied is never edited ([ADR-0004](adr/0004-data-layer.md)).
