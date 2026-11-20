# AGENTS.md

Guide for coding agents (and people) working in CivicSignal: open-source verified-human civic polling. Read this first; `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `docs/` hold the detail.

## Stack

- pnpm 9.15.4 workspace (`pnpm-workspace.yaml`) with Turborepo (`turbo.json`). Node >= 24.22.1 (`engines` in `package.json`).
- `apps/web`: Next.js 16 (App Router, React 19, Tailwind 4), TypeScript. Production output is `standalone`.
- Plain Postgres 17 through `pg` (`packages/db`), no ORM and no row-level security: every access rule is a server-side check listed in `docs/authz-policies.md`.
- Tests: vitest (`pnpm -r test`) and a Playwright `@smoke` set at the repo root.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js app (`app/`, `middleware.ts`, tests in `test/`) |
| `packages/db` | Postgres client, migrations (`migrations/*.sql`), migrator, row types |
| `packages/crypto` | Vote sealing, receipts, hashing |
| `packages/ui` | Shared UI components |
| `services/resolver` | Background service that closes polls, commits Merkle roots and scores resolved polls |
| `docs/` | Product spec, schema, authz rules, design brief, launch QA |
| `scripts/` | `deploy.sh`, `host/` (runner and env setup), lifecycle smoke scripts, `smoke/` (the browser smoke's webServer script) |
| `e2e/`, `playwright.config.ts` | Playwright `@smoke` specs and config |

## Commands

These are the merge checks declared in `.drove.json`. Run them from the repo root.

- Install (`setup`): `pnpm install --frozen-lockfile`
- Typecheck: `npx --yes pnpm@9.15.4 typecheck`
- Lint: `npx --yes pnpm@9.15.4 lint`
- Unit tests: `npx --yes pnpm@9.15.4 -r test` (workspace packages only; no database needed)
- Build: `npm run build` (runs `turbo run build`; `next build` fetches Google Fonts, so it needs network access)
- Browser smoke: `npm run test:smoke` (see below)

Root scripts in `package.json`: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run db:migrate`, `npm run db:generate`, `npm run test:smoke`. There is no root `test` script; use `pnpm -r test`. Postgres-backed suites run per package with a throwaway container (Docker required): `pnpm --filter @civicsignal/web test:pg`, and the same for `@civicsignal/db` and `@civicsignal/resolver`.

## Run locally

1. Start a Postgres 17 and migrate it: `docker run -d --name civicsignal-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=civicsignal -p 5432:5432 postgres:17-alpine`, then `DATABASE_URL=postgresql://postgres:dev@localhost:5432/civicsignal npm run db:migrate`.
2. Copy `.env.example` to `apps/web/.env.local`, set `DATABASE_URL`, `APP_URL=http://localhost:3000` and `EMAIL_FROM`, and drop `NODE_ENV`. `RESEND_API_KEY` may stay empty: verification and reset links are then printed in the server log.
3. `npm run dev` starts the web app (`next dev --webpack`; Turbopack has known problems in this monorepo) and the resolver.

Never commit real secrets, database URLs or Resend keys.

## Browser smoke (`npm run test:smoke`)

Headless Chromium only, never in GitHub CI. `npm run test:smoke` is plain `playwright test` (`playwright.config.ts`, `list` reporter, projects at 1440 and 390 wide, `reuseExistingServer: false`), so it is self-contained: the Playwright webServer is `scripts/smoke/serve.mjs`, which

1. checks that Docker works (exits nonzero with a message if not);
2. always runs `npm run build` first (turbo-cached on its inputs, so a stale `.next` is never served; the smoke serves the production build with `next start`, not the dev server);
3. starts its own `postgres:17-alpine` container (unique name, random host port), migrates it, and removes it when the server exits, on failure or on SIGTERM/SIGINT;
4. runs `next start` on the smoke port: 3100 by default (fixed, because Playwright re-evaluates the config in every worker), or set `E2E_PORT`. If that port is busy the run fails instead of reusing it.

The app gets the throwaway `DATABASE_URL` and dummy values for everything else (`RESEND_API_KEY` empty, no real secrets), whatever the shell has set. The specs open `/` (landing page) and `/polls` (the primary public screen, not behind the `middleware.ts` auth redirect), assert the headline renders, no console error, no page error, no same-origin 4xx/5xx and no horizontal overflow. Output goes to `test-results/` (gitignored). The Drove merge gate runs it after the build.

## Deploy

- Push or merge to `main` runs `.github/workflows/deploy.yml` on the self-hosted runner `civicsignal-runner`, which runs `scripts/deploy.sh`: install, `pnpm -r test`, docker image builds, migrations, start, health check (`/api/health`). A commit message containing `[skip ci]` does not deploy.
- PR CI (`.github/workflows/ci.yml`) runs on GitHub-hosted runners only (this is a public repo) and runs install, typecheck, lint and `pnpm -r test`. No browser or Docker work belongs there.
- Production runs on clawdius behind Docker Compose; runtime config is in `/home/runner/civicsignal-secrets/web.env` (see `.env.example`).

## Branches and git

- Branch from main without tracking: `git switch -c <name> --no-track origin/main`.
- Never push to a `production` branch. `main` deploys, so treat a push to it as a release.
- Conventional commit messages; open PRs against `main`.

## Repo constraints

- Database access goes through `@civicsignal/db` and only from server code. Every authorization rule is an explicit, tested server check (`docs/authz-policies.md`); mutating requests must come from the `APP_URL` origin.
- Migrations are plain numbered SQL files in `packages/db/migrations/`, applied once each by the migrator; add a new file rather than editing an applied one.
- Votes are sealed: the server stores only ciphertext and a receipt hash. Do not log or persist readable answers.
- When a change alters the trust model, update the homepage, `/methodology`, `/roadmap` and `README.md` in the same PR (`CONTRIBUTING.md`).
- Style: TypeScript with no `any`, arrow functions, functional React components, named exports (default exports for pages).
- Report vulnerabilities privately as described in `SECURITY.md`, not in public issues.
