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

## Admin

The admin lives at `/admin` ([ADR-0006](adr/0006-auth.md)). Without the variables below, its login page says it is not configured.

1. **Database.** Apply the `0002_auth` migration to Neon: `pnpm db:migrate`, from a machine whose `.env.local` holds its `DATABASE_URL`.
2. **Sealing key.** Generate one with `openssl rand -base64 32`, and add it as `TOTP_ENCRYPTION_KEY` (Production, _Sensitive_). Add the same value to that machine's `.env.local`: the CLI seals the second factor with it, and refuses to write to Neon without it. Keep a copy in a password manager: without it the TOTP secret cannot be read, and the second factor must be reset (step 5). `IP_HASH_SALT`, already set for the contact form, keys the throttling and the audit log's network hashes.
3. **Redeploy**, so the variable applies.
4. **Account**, with the phone at hand, from the same machine: `pnpm admin:create`. It asks for the email and a passphrase (15 characters or more), and refuses a password found in known breaches. It then shows a QR code in the terminal: scan it with an authenticator app (Aegis, 2FAS, Google Authenticator…) and type the first code the app shows. Only then is the account created, with its second factor on, and 10 recovery codes are printed: store them in a password manager, they are shown once. The web never sets up a second factor: `/admin/login` asks for the password, then a code.
5. **If something goes wrong**, from the same machine:
   - `pnpm admin:unlock` lifts every sign-in lock: 5 failures lock an account from one network for a minute, doubling to an hour; 10 wrong TOTP codes, from any network, lock the code step for an hour (recovery codes still work). With `RESEND_API_KEY` and `CONTACT_TO_EMAIL` set, a lock that starts is emailed, at most once an hour;
   - `pnpm admin:set-password`, when the password is forgotten or may have leaked: it sets a new one, ends every session and lifts every lock (whoever holds a leaked password can keep the code step locked, and the web asks for a code to change it);
   - `pnpm admin:reset-totp`, when both the phone and the recovery codes are lost: it ends every session, shows a new QR code, and once the new app's first code matches, replaces the second factor and prints new recovery codes.

Previews have no `TOTP_ENCRYPTION_KEY` unless one is added for Preview: their admin then says it is not configured, which is expected. The development key is refused on Vercel.

## Media

The image library (`/admin/media`, [ADR-0007](adr/0007-admin.md)) keeps its files in Vercel Blob.

1. **Database.** Apply the migrations not yet on Neon, `0003_slug_redirects` and `0004_media` among them: `pnpm db:migrate`, from the machine whose `.env.local` holds its `DATABASE_URL`. `0003` also tightens the social links' `mailto:` check: a stored address followed by `?` or `#` would stop it, so correct such a link first.
2. **Blob store.** In the Vercel project, _Storage_ → _Create_ → _Blob_, connected to Production (and to Preview, to upload there too). Vercel adds `BLOB_READ_WRITE_TOKEN`.
3. **Redeploy**, so the variable applies.

Without the token, production builds and previews refuse uploads: the library says the service is unavailable, and the logs show `media.storage_not_configured`. Development and the E2E suite store images under `.media/` (gitignored), served by the app itself.

## After a deployment

- `https://<project>.vercel.app/fr` shows the hub, and an unknown path such as `/fr/inconnu` answers `404`.
- The response headers carry `Content-Security-Policy` (enforced) and `Reporting-Endpoints`.
- The runtime logs show no `csp.violation` warnings, and no `db.not_configured` or `DB_UNAVAILABLE` errors.
- `/admin` redirects to `/admin/login`, whose response carries `X-Robots-Tag: noindex, nofollow`; the logs show no `auth.not_configured`.
- `/admin/media` takes an image, and the project page whose cover it is shows it, served from `*.public.blob.vercel-storage.com`.
- `/fr/contact` shows the form and the Turnstile widget. A test message appears in `contact_messages` and arrives by email, and the logs show no `contact.not_configured`, `contact.turnstile_*` or `contact.mail_*` entries.

## Content updates

Content is edited in the admin, and shows on the site at once. `scripts/seed/content.ts` and `pnpm db:seed` fill an empty database: run again, the seed writes its own content over the admin's edits of the entries it knows (by slug), their images included. It never deletes: a renamed slug leaves the old row in the database.

## Schema changes

Run `pnpm db:generate`, commit the new migration, then `pnpm db:migrate` against Neon before deploying code that depends on it. A migration already applied is never edited ([ADR-0004](adr/0004-data-layer.md)).
