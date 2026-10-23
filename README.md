# Portfolio

Personal portfolio of a software engineer working across fullstack web, DevOps and security. Bilingual (FR/EN), and built as a showcase in itself: code quality, security hardening and delivery practices are part of what it demonstrates.

> **Status: P0 — foundations.** The site is a placeholder while the building blocks land phase by phase.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Zod · Vitest · Playwright · GitHub Actions · Vercel. PostgreSQL on Neon arrives in P2.

Version choices and their rationale: [ADR-0001](docs/adr/0001-stack.md).

## Getting started

Requirements: Node.js 24+ and pnpm 11 (the version is pinned in `package.json`).

```bash
pnpm install
cp .env.example .env.local   # every variable is validated at startup
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command              | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `pnpm dev`           | Development server                                         |
| `pnpm build`         | Production build (fails fast on an invalid environment)    |
| `pnpm start`         | Serve the production build                                 |
| `pnpm lint`          | ESLint, zero warnings allowed                              |
| `pnpm format`        | Format with Prettier (`format:check` in CI)                |
| `pnpm typecheck`     | Generate route types, then `tsc --noEmit`                  |
| `pnpm test`          | Unit tests (Vitest)                                        |
| `pnpm test:coverage` | Unit tests with coverage, 80 % minimum on every metric     |
| `pnpm e2e`           | End-to-end tests (Playwright) against the production build |

Commits follow [Conventional Commits](https://www.conventionalcommits.org); a pre-commit hook lints and formats staged files.

## Continuous integration

Every pull request and every push to `main` runs:

- **CI** — format check, type check, lint, unit tests with coverage thresholds, production build, Playwright E2E.
- **Security** — secret scanning (gitleaks), static analysis (CodeQL, `security-extended`), dependency vulnerabilities (OSV-Scanner). Also runs weekly.

Actions are pinned to commit SHAs; Dependabot keeps dependencies and actions current with a 7-day cooldown.

## Security

- Content Security Policy with a per-request nonce and `strict-dynamic`, currently in report-only mode and enforced before the first user-input form ships — see [ADR-0002](docs/adr/0002-csp.md).
- HSTS, `nosniff`, framing protection, strict referrer and permissions policies, cross-origin isolation headers.
- Environment validated at startup; structured logs with secrets redacted and emails masked.

Found a vulnerability? Please follow the [security policy](SECURITY.md).

## License

Source code is released under the [MIT License](LICENSE). Written content, images and personal data presented on the site are © their author, all rights reserved.
