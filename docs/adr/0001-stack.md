# ADR-0001 — Technical stack and versions

- **Status:** Accepted
- **Date:** 2026-10-23
- **Phase:** P0 — Foundations

## Context

The portfolio must prove skills as much as it presents them: the repository, its tooling and its pipeline are part of the showcase. The stack was fixed in the project brief (Next.js on Vercel, PostgreSQL on Neon, FR/EN, TypeScript). This record pins the exact versions chosen on 2026-10-23 and explains every deviation from "latest".

## Decision

| Concern         | Choice                                                      | Version     |
| --------------- | ----------------------------------------------------------- | ----------- |
| Runtime         | Node.js LTS in CI and on Vercel (`.nvmrc`)                  | 24          |
| Package manager | pnpm (`packageManager` field)                               | 11.25       |
| Framework       | Next.js, App Router, Turbopack                              | 16.4.2      |
| UI library      | React                                                       | 19.3        |
| Rendering model | `cacheComponents` + `partialPrefetching` (template default) | —           |
| Language        | TypeScript, `strict` + `noUncheckedIndexedAccess`           | 5.9         |
| Styling         | Tailwind CSS                                                | 4.3         |
| Validation      | Zod                                                         | 4.6         |
| Lint / format   | ESLint (`eslint-config-next`), Prettier                     | 9.39 / 3.9  |
| Unit tests      | Vitest (node + jsdom projects), Testing Library             | 5.0         |
| E2E tests       | Playwright (Chromium)                                       | 1.64        |
| Git hooks       | Husky + lint-staged + commitlint (Conventional Commits)     | 9 / 17 / 21 |
| Observability   | Vercel Analytics + Speed Insights (cookieless)              | 2.0         |

### Deviations from "latest"

- **TypeScript 5.9, not 7.0.** TypeScript 7 is the native (Go) compiler. `typescript-eslint` 8.72 requires `typescript >=4.8.4 <6.1.0`, so type-aware linting would break. Revisit when `typescript-eslint` supports 7.x.
- **ESLint 9, not 10.** `create-next-app` 16.4.2 pins `eslint@^9` and `eslint-config-next` relies on plugins (`eslint-plugin-react`, `eslint-plugin-import`) not yet validated on ESLint 10. Dependabot will surface the upgrade.
- **Node 24 in CI/Vercel while developing on Node 26.** Vercel and CI run the Active LTS; `engines.node` is `>=24` so both work locally.

### Conventions established

- Expected failures are returned as `Result<T>` values (`src/lib/result.ts`); exceptions are reserved for the unexpected.
- Logs are structured JSON lines with secrets redacted and emails masked (`src/lib/logger.ts`, `src/lib/redact.ts`); `console.*` is used nowhere else.
- Environment variables are validated with Zod at startup (`src/lib/env.ts`, called from `next.config.ts`): an invalid environment fails `next dev` and `next build` immediately, and error messages name the variable without echoing its value.

## Consequences

- Exact versions live in `pnpm-lock.yaml`; Dependabot proposes updates weekly with a 7-day cooldown (security fixes are not delayed).
- GitHub Actions are pinned to commit SHAs, with the tag in a comment, so a moved tag cannot change what runs in CI.
- Every later phase starts by checking the docs bundled with the installed version (`node_modules/next/dist/docs/`): Next.js 16 APIs and conventions differ from earlier releases.
