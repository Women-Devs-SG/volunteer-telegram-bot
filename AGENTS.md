# AGENTS.md

Agent-facing reference for working in this repo. Read this before making changes. Human-facing setup/contribution docs live in [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md) — this file is the condensed version for an agent about to edit code.

## What this is

A Telegram bot for the Women Devs SG community's volunteer management (onboarding, probation tracking, event/task planning, admin broadcasts). TypeScript, [grammY](https://grammy.dev/) for the bot framework, [Drizzle ORM](https://orm.drizzle.team/) over Postgres.

It runs two ways, and this matters for almost every change:
- **`src/bot.ts`** — long-polling process, used for local dev and staging.
- **`api/webhook.ts`** — Vercel serverless function, used for production.

Both register the same set of commands independently. Local dev needs no external database — [PGlite](https://github.com/electric-sql/pglite) (in-memory/file-backed Postgres) is used automatically when `NODE_ENV=development`.

## Commands

```bash
npm run type-check              # tsc --noEmit
npm run lint                    # tsc --noEmit && eslint --quiet --fix
npm test                        # vitest run (uses PGlite, no .env needed)
npm run test:watch
npm run test:coverage
npm run test:local               # same as `npm test` but loads .env.local first

npm run dev:local                # long-polling bot against PGlite (needs .env.local: BOT_TOKEN)
npm run setup:fresh               # reset:local + setup:local (migrate + seed)
npm run setup:local                # migrate + seed against existing local db

npm run db:generate                # generate a migration from src/schema.ts changes
npm run db:migrate:local | :staging | :prod
npm run db:studio:local | :staging | :prod   # Drizzle Studio GUI

npx ts-node scripts/check-command-parity.ts   # verify src/bot.ts and api/webhook.ts register the same commands
```

There is no npm script for the parity check — invoke `ts-node` directly, or check the `bot.command('...')` calls manually.

A husky pre-commit hook runs `npx lint-staged`, which runs `npm run lint` on staged `.js`/`.ts`/`.mts` files. Don't bypass it with `--no-verify`.

## Architecture — read before editing

- **Command handlers** live in `src/commands/{admins,broadcast,events,volunteers}.ts`, grouped by domain, not by command.
- **`src/bot.ts`** imports every handler and calls `bot.command(...)` to register it (long-polling entry point).
- **`api/webhook.ts`** is a second, independent registration of the same commands (Vercel webhook entry point). **Any command added, removed, or renamed in one file must be mirrored in the other** — this is the single most common way to accidentally ship a bot that behaves differently in local/staging vs. production. Run `npx ts-node scripts/check-command-parity.ts` after touching either file.
- **`src/schema.ts`** is the source of truth for the Drizzle schema: 5 tables (`volunteers`, `events`, `tasks`, `task_assignments`, `admins`) and 4 pg enums (`volunteer_status`, `event_format`, `event_status`, `task_status`).
- **`src/types.ts`** hand-maintains plain TS interfaces mirroring the same shapes for code that doesn't want Drizzle's inferred types. When `schema.ts` changes, check whether `types.ts` needs the same change — nothing enforces this automatically.
- **`src/db-drizzle.ts`** (`DrizzleDatabaseService`) is the sanctioned data-access layer. Command handlers should call it rather than importing `db` from `src/drizzle.ts` and querying directly.
- **`src/drizzle.ts`** picks the driver from `NODE_ENV`: `development` → PGlite (file-backed at `./local-db/`, or in-memory if `PGLITE_STORAGE=memory`); `staging`/`production` → real Postgres via `STAGING_DATABASE_URL`/`PRODUCTION_DATABASE_URL` (falls back to `DATABASE_URL`).
- **Three deployment environments**, each with its own env file and Vercel config: `.env.local` + `vercel.json` (dev), `.env.staging` + `vercel.staging.json`, `.env.production` + `vercel.production.json`. Scripts are consistently suffixed `:local` / `:staging` / `:prod` — there's no bare script that touches a real database.
- **`src/onboarding-pages/*.html`** are static onboarding pages served to volunteers; they're content, not logic — changes here rarely need tests.
- **`api/keep-alive.ts`** is a Vercel Cron target (scheduled daily via the `crons` field in `vercel.staging.json`/`vercel.production.json`, deliberately not in the root `vercel.json` since local PGlite has no pause behavior) that runs `DrizzleDatabaseService.pingDatabase()` — a read-only query that keeps Supabase's free-tier project from auto-pausing after 7 days of inactivity. It's not a bot command, so it isn't registered in `src/bot.ts`/`api/webhook.ts` and the command-parity check doesn't apply to it. If `CRON_SECRET` is set, requests must carry a matching `Authorization: Bearer` header.

## Testing

- Framework: [Vitest](https://vitest.dev/). Tests live in `tests/`, not co-located with `src/`.
- `tests/setup.ts` creates enums/tables via raw SQL directly against PGlite (not through Drizzle migrations) and truncates all tables before each test. It force-sets `NODE_ENV=development` regardless of how the test runner was invoked.
- `tests/database.test.ts` — tests against `DrizzleDatabaseService` / schema-level behavior.
- `tests/bot-commands.test.ts` — command-handler tests; mock `DrizzleDatabaseService` with `vi.mock` rather than hitting PGlite, unless the test is deliberately integration-style.
- `vitest.config.ts` runs tests with `pool: 'forks'` and `singleFork: true` — PGlite doesn't tolerate concurrent test workers, so don't change this without understanding why.
- New command handler → test in `tests/bot-commands.test.ts`. New `DrizzleDatabaseService` method → test in `tests/database.test.ts`. New pure helper (`src/utils.ts`, `src/parse-topic-link.ts`) → its own test file in `tests/`.

## Conventions

- **Commits**: conventional style, `type: subject` or `type(scope): subject`. Types actually used in history: `feat`, `fix`, `docs`, `chore`, `test`, `build`, `refactor`. PRs are squash-merged and GitHub appends `(#N)` to the subject automatically — don't add the PR number yourself.
- **Telegram formatting**: handlers mix HTML and Markdown parse modes — match whatever the surrounding handler already uses rather than introducing a third style. Always escape user-controlled text (volunteer names, handles, free-text fields) before interpolating into an HTML-parsed message (see `escapeHtml` in `src/utils.ts`).
- **Admin authorization**: gate admin-only commands with `requireAdmin` from `src/commands/admins.ts` — never write an ad hoc secret check.
- **Interactive wizards**: multi-step flows use grammY session state (`SessionFlavor`) — see `handleEventWizard` / `handleAddVolunteerWizard` for the pattern. Always give the user a way out via `/cancel`.
- **Env vars**: every variable read via `process.env` must be documented (with a placeholder, never a real secret) in **all three** of `.env.local.example`, `.env.staging.example`, `.env.production.example`. The three files intentionally differ on which optional vars are commented out, but a genuinely new var belongs in all three.
- **No large binaries or generated artifacts** — this repo has no fixture/binary-asset convention; if a change needs one, flag it rather than committing it silently.

## Docs to keep in sync

Update these when the corresponding behavior changes — nothing enforces this automatically:

- **README.md** "Commands Reference" section — when a user- or admin-facing command is added, removed, or renamed.
- **CONTRIBUTING.md** "Bot Commands" section — same trigger.
- **`.github/pull_request_template.md`**'s parity/testing checklist — nothing to edit, just fill it in accurately when opening a PR.
