# Portfolio

Personal portfolio of a software engineer working across fullstack web, DevOps and security. Bilingual (FR/EN), and built as a showcase in itself: code quality, security hardening and delivery practices are part of what it demonstrates.

> **Status: P6 — admin back office, in progress.** A bento hub whose tiles open into full-screen views, read from PostgreSQL, a contact form protected by Turnstile and a shared rate limit, and an admin behind a password and a mandatory second factor, with an inbox for the contact messages. Content editing, media and the blog come next.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 · next-intl · PostgreSQL on Neon with Drizzle · Zod · Cloudflare Turnstile · Upstash Redis · Resend · Vitest · Playwright · GitHub Actions · Vercel.

Decisions and their rationale live in [`docs/adr/`](docs/adr): [stack](docs/adr/0001-stack.md), [CSP](docs/adr/0002-csp.md), [hub, transitions and 404s](docs/adr/0003-transitions.md), [data layer](docs/adr/0004-data-layer.md), [contact form](docs/adr/0005-contact-form.md), [admin authentication](docs/adr/0006-auth.md), [admin back office](docs/adr/0007-admin.md).

## Getting started

Requirements: Node.js 24+ and pnpm 11 (the version is pinned in `package.json`).

```bash
pnpm install
cp .env.example .env.local   # every variable is validated at startup
pnpm dev                     # http://localhost:3000
```

Pages read PostgreSQL. Set `DATABASE_URL` in `.env.local` to a Neon database, or to a local one, which the app and scripts reach with plain Postgres:

```bash
docker run -d --name portfolio-pg -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=portfolio -p 5432:5432 postgres:18.6-alpine
# .env.local: DATABASE_URL=postgresql://postgres@localhost:5432/portfolio
pnpm db:migrate && pnpm db:seed
```

Without a database the site still runs, with a notice where content would be.

## Scripts

| Command                   | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `pnpm dev`                | Development server                                                    |
| `pnpm build`              | Production build (fails fast on an invalid environment)               |
| `pnpm start`              | Serve the production build                                            |
| `pnpm lint`               | ESLint, zero warnings allowed                                         |
| `pnpm format`             | Format with Prettier (`format:check` in CI)                           |
| `pnpm typecheck`          | Generate route types, then `tsc --noEmit`                             |
| `pnpm test`               | Unit tests (Vitest)                                                   |
| `pnpm test:coverage`      | Unit tests with coverage, 80 % minimum on every metric                |
| `pnpm e2e`                | End-to-end tests (Playwright) against the production build            |
| `pnpm db:generate`        | Generate a SQL migration from the Drizzle schema                      |
| `pnpm db:migrate`         | Apply pending migrations to `DATABASE_URL`                            |
| `pnpm db:seed`            | Upsert the content of `scripts/seed/content.ts`                       |
| `pnpm admin:create`       | Create the admin account, its authenticator enrolled in the terminal  |
| `pnpm admin:unlock`       | Lift every sign-in lock                                               |
| `pnpm admin:set-password` | Set a new password, ending every session and lifting every lock       |
| `pnpm admin:reset-totp`   | Enroll a new authenticator when the phone and recovery codes are lost |

`pnpm e2e` reads the database of `DATABASE_URL`: point it at a local one, migrated and seeded (`DATABASE_URL=postgresql://postgres@localhost:5432/portfolio pnpm e2e`). The admin tests replace its admin account, and refuse to run against any other.

Commits follow [Conventional Commits](https://www.conventionalcommits.org); a pre-commit hook lints and formats staged files.

## Continuous integration

Every pull request and every push to `main` runs:

- **CI** — format check, a check that the schema and the committed migrations agree, type check, lint, unit tests with coverage thresholds, production build, and Playwright E2E (axe-core included) against a throwaway PostgreSQL, migrated and seeded.
- **Security** — secret scanning (gitleaks), static analysis (CodeQL `security-extended`, Semgrep registry rulesets), dependency vulnerabilities (OSV-Scanner). Also runs weekly.

Actions are pinned to commit SHAs; Dependabot keeps dependencies and actions current with a 7-day cooldown.

## Security

- Enforced Content Security Policy with a per-request nonce and `strict-dynamic`, and a rate-limited endpoint collecting violation reports — see [ADR-0002](docs/adr/0002-csp.md).
- Contact form: Turnstile verified on the server, a honeypot, 5 messages an hour per sender and 30 overall (senders known by a keyed hash, never by their address), messages stored before any email is sent — see [ADR-0005](docs/adr/0005-contact-form.md).
- Admin: argon2id passwords checked against known breaches, mandatory TOTP enrolled from the CLI (never on the web) with one-time recovery codes, database sessions stored by the hash of their token, progressive lockout that an attacker cannot turn against the owner, and an audit log — see [ADR-0006](docs/adr/0006-auth.md) and the [OWASP ASVS 5.0 level 2 self-assessment](docs/security/auth-asvs.md).
- HSTS, `nosniff`, framing protection, strict referrer and permissions policies, cross-origin isolation headers.
- Environment validated at startup; structured logs with secrets redacted and emails masked.

Found a vulnerability? Please follow the [security policy](SECURITY.md).

## Deployment

Vercel, with the database on Neon, and Turnstile, Upstash and Resend for the contact form: see [`docs/deploy.md`](docs/deploy.md).

## License

Source code is released under the [MIT License](LICENSE). Written content, images and personal data presented on the site are © their author, all rights reserved.
