---
name: implement-issue
description: Implements a code change from an issue prompt in the volunteer-telegram-bot repo (grammY + Drizzle ORM Telegram bot). Ensures correct branch, derives acceptance criteria, writes vitest tests per project conventions, verifies command parity between src/bot.ts and api/webhook.ts when bot commands change, commits atomically with conventional-commit messages, updates docs (AGENTS.md/CLAUDE.md/README.md/CONTRIBUTING.md/.env.*.example) on completion, and only marks done when the full test suite passes.
---

You are implementing a code change described in an issue or prompt for `volunteer-telegram-bot` — a TypeScript Telegram bot using grammY and Drizzle ORM (see [AGENTS.md](../../../AGENTS.md) for the architecture, testing, and convention reference — read it now if you haven't already). Follow every step in order. Do not skip steps or combine commits.

## Arguments

`$ARGUMENTS` contains either:
- Raw issue text (title, description, acceptance criteria)
- A file path to an issue/doc (read it with Read)
- A plain description of the change to make

If no arguments are given, ask the user what they want to implement before proceeding.

---

## Step 0 — Parse the issue

Extract the following from `$ARGUMENTS`:

| Field | Where to find it | Fallback |
|-------|-------------------|----------|
| **Title** | First heading or first sentence | Ask the user |
| **Branch name** | Explicit branch field in issue, or derive from title | See naming rules below |
| **Description** | Body of the issue / Summary / Motivation / Current behavior sections | The full prompt |
| **Acceptance criteria** | "Acceptance criteria" section (Happy path / Error path) | Derive them yourself (Step 2) |
| **Out of scope** | "Out of scope" section | Assume nothing is explicitly excluded |
| **Technical context** | "Technical context" section | Identify from description |
| **Additional test scenarios** | "Additional test scenarios" section | None beyond ACs |
| **Hard constraints** | "Hard constraints" section | No additional constraints |
| **Dependency issues** | "Dependency issues" section | None |

**Branch naming rules** (in priority order):
1. Use the branch name explicitly stated in the issue.
2. Derive from the issue title: lowercase, hyphens, prefixed with type:
   - New feature → `feat/<slug>`
   - Bug fix → `fix/<slug>`
   - Refactor → `refactor/<slug>`
   - Infrastructure / tooling / build config → `chore/<slug>`
   - Docs only → `docs/<slug>`
   - Test-only → `test/<slug>`
   - Keep slug under 40 characters; drop articles and filler words

---

## Step 1 — Branch setup

```bash
# 1a. What branch am I on?
git branch --show-current

# 1b. What is the default branch? (main)
git remote show origin | grep 'HEAD branch'
```

**If currently on main:**
```bash
git pull origin main
git checkout -b <branch-name>
```

**If currently on an existing feature branch that matches the target branch name:**
- Verify it is branched from a recent commit of main:
```bash
git merge-base --is-ancestor $(git rev-parse origin/main) HEAD || echo "BEHIND MAIN"
```
- If behind, rebase: `git fetch origin && git rebase origin/main`

**If currently on an unrelated branch:**
- Do NOT check out main and trash the unrelated work.
- Report to the user: "Currently on branch X which does not match the target branch Y. Please confirm you want to switch."
- Wait for confirmation before proceeding.

**Verify the final state before continuing:**
```bash
git status && git log --oneline -5
```

---

## Step 2 — Acceptance criteria

If the issue already has explicit acceptance criteria, list them verbatim.

If missing or vague, **derive them yourself** from the description as a numbered checklist of verifiable, binary outcomes. Each criterion must be falsifiable — "the bot works" is not acceptable; "`/my_tasks` replies with the caller's assigned tasks, or 'No tasks assigned' if there are none" is.

Example format:
```
Acceptance Criteria (derived):
1. `/my_tasks` lists every task assigned to the calling volunteer via `task_assignments`.
2. A volunteer with no assignments sees a friendly "No tasks assigned yet" message, not an error.
3. The command is registered identically in both `src/bot.ts` and `api/webhook.ts`.
4. `npm test` passes with at least one new test covering both cases above.
```

Write the acceptance criteria to a TodoWrite task list so you can track them as you go.

---

## Step 2.5 — Extract scope boundaries and constraints

Before writing a single line of code, record the guardrails from the issue.

### Out of scope

```
Out of scope (must NOT implement):
- <item 1>
```

If missing or empty, write "None stated — use judgement."

### Hard constraints

```
Hard constraints (must satisfy):
- <constraint 1>
```

If missing or empty, write "None stated beyond project defaults (see AGENTS.md — command parity, env var documentation in all three .env.*.example files, admin gating via requireAdmin)."

### Additional test scenarios

List any items from "Additional test scenarios" beyond the acceptance criteria — these become additional test stubs in Step 2.6.

---

## Step 2.6 — Derive test plan from acceptance criteria

Before writing any implementation code, produce a complete test-to-AC mapping.

**Hard requirement: every acceptance criterion — happy path, error path, and additional test scenario — must map to at least one automated Vitest test.** The only exception is a scenario that is genuinely non-automatable (e.g. verifying a Telegram message renders correctly on a real device) — classify that explicitly as `manual` in the mapping below, which routes it to `pre-push-audit`'s human testing gate instead of silently dropping it.

Use this default (per [AGENTS.md](../../../AGENTS.md)'s Testing section):

| Condition | Test type | Location |
|-----------|-----------|----------|
| New/changed bot command handler | Test in `tests/bot-commands.test.ts`, mocking `DrizzleDatabaseService` with `vi.mock` | `tests/bot-commands.test.ts` |
| New/changed `DrizzleDatabaseService` method | Test against real PGlite | `tests/database.test.ts` |
| Pure helper function (`src/utils.ts`, `src/parse-topic-link.ts`, etc.) | Unit test | `tests/<matching-name>.test.ts` |
| Schema change (`src/schema.ts`) | Round-trip/insert test via `DrizzleDatabaseService` or raw query | `tests/database.test.ts` |
| Command added/removed/renamed in `src/bot.ts` or `api/webhook.ts` | Parity check, not a Vitest test | `npx ts-node scripts/check-command-parity.ts` — still record it as a gate in the plan |
| Onboarding HTML page, docs, config-only change | No test required | — |
| Rendering correctness of a Telegram message on-device (emoji, HTML parse mode quirks) | Manual | — |

```
Test plan (derived from ACs):

Happy path:
  AC #1 — <criterion text>
    → Test type: unit | database | bot-command | parity | manual
    → File: <where the test will live>
    → Stub: <one sentence describing what the test asserts>

Error path / edge cases:
  AC #N — ...

Additional test scenarios:
  TS #1 — ...
```

**Default to automated.** Only classify a scenario as manual if it tests something a headless assertion genuinely can't capture. Build success and command parity are always automatable — cover them with `npm run lint`/the parity script, not a manual checklist item.

Add each test stub as a TodoWrite task. **No implementation commit may be started until all test stubs for its ACs are written and failing correctly.**

---

## Step 3 — Implementation plan

Before writing any code, plan the atomic commits you will make. Each commit should:
- Change one logical unit (one command, one schema change, one shared helper)
- Leave the repo in a passing-tests state
- Have a conventional commit message (see Step 5e for format)

```
Commit plan:
1. feat(volunteers): add /my_tasks command handler
2. test(volunteers): cover /my_tasks happy path and empty-list case
3. chore(webhook): mirror /my_tasks registration in api/webhook.ts
```

Use TodoWrite to track each commit as a task.

---

## Step 4 — Confirm test conventions

Re-read the Testing section of [AGENTS.md](../../../AGENTS.md) if you haven't already this session — confirm which test file(s) this issue's changes belong in per Step 2.6, and note that `tests/setup.ts` truncates all tables before each test, so tests must not depend on ordering or leftover state from a previous test.

---

## Step 5 — Implement each commit

For each commit in your plan:

### 5a. Write the tests for this commit's acceptance criteria (must precede implementation)

Locate the test stubs from Step 2.6 that correspond to the ACs this commit satisfies. For each stub:

- Follow the exact file location recorded in the stub
- Write the full test body — not just a placeholder; it must be specific enough to fail if the implementation is wrong
- Every new command handler: at least one happy-path test + one error/edge-case test matching the AC
- Run only the related test file to confirm it **fails** correctly before implementing:

```bash
npx vitest run tests/<file>.test.ts
```

### 5b. Write the implementation

Before writing code, verify this commit stays within scope and satisfies constraints:

1. Check every file you plan to touch against the out-of-scope list from Step 2.5.
2. Confirm every hard constraint from Step 2.5 will still be satisfied after this change.

Then implement, following the conventions in [AGENTS.md](../../../AGENTS.md):

- Command handlers go through `DrizzleDatabaseService` (`src/db-drizzle.ts`) — don't query `db` directly from a handler.
- If this commit adds, removes, or renames a `bot.command(...)` registration, mirror the change in **both** `src/bot.ts` and `api/webhook.ts` in the same commit — don't leave them out of sync even temporarily.
- Admin-only commands call `requireAdmin` — don't duplicate an ad hoc secret check.
- Interpolating user-controlled text (names, handles, free text) into an HTML-parse-mode message must go through `escapeHtml` (`src/utils.ts`).
- Multi-step interactive flows use grammY session state — follow the existing `handleEventWizard`/`handleAddVolunteerWizard` pattern and always provide `/cancel`.
- If this commit changes `src/schema.ts`, check whether `src/types.ts`'s hand-maintained interfaces need the same change — nothing enforces this automatically.
- Follow existing code style in the file being edited.

### 5c. Run the tests

```bash
npx vitest run tests/<file>.test.ts
```

Fix any failures before proceeding to commit. Do not commit with a known failing test.

### 5d. Lint and type-check

```bash
npm run lint
```

Fix all errors and warnings before committing.

**Command parity check:** if this commit touches `src/bot.ts` or `api/webhook.ts`, run:

```bash
npx ts-node scripts/check-command-parity.ts
```

It must report `✅ Command parity OK` before this commit is considered done.

### 5e. Commit

**Before staging:** run `git diff --cached --name-only` after staging your intended files. Remove any out-of-scope files before committing:

```bash
git restore --staged <unintended-file>
```

Only files listed in this commit's plan should appear in `git diff --cached --name-only`.

```bash
git add <specific-files>   # never git add -A
git commit -m "$(cat <<'EOF'
<type>(<scope>): <short imperative summary under 72 chars>

<Body: 2–5 lines explaining WHY this change exists, what problem it solves,
and any non-obvious decisions. Any future agent reading git log should
understand the intent without opening the files.>
EOF
)"
```

**Commit type prefixes** (matching this repo's actual history):

| Prefix | Use when |
|--------|----------|
| `feat` | New production functionality |
| `fix` | Bug correction |
| `test` | Adding or fixing tests only |
| `refactor` | Code restructured, no behaviour change |
| `chore` | Build, tooling, dependencies, config, cross-file wiring (e.g. webhook parity) |
| `docs` | Documentation only |
| `build` | Build/tooling setup (eslint, tsconfig, etc.) |

**Scope** = the area being changed (`volunteers`, `admins`, `events`, `broadcast`, `webhook`, `schema`, `db`, `ci`, `docs`).

Repeat Step 5 for every commit in your plan.

---

## Step 6 — Full test suite

```bash
npm test
npm run lint
npx ts-node scripts/check-command-parity.ts   # only if src/bot.ts or api/webhook.ts changed
```

If any command fails or reports issues:
- Fix the failure
- Add a new commit (`fix(<scope>): <what broke and why>`)
- Re-run until clean

Do not mark the work complete until the full suite is clean.

---

## Step 7 — Acceptance criteria verification

Go through each acceptance criterion from Step 2. For each one, name the specific automated test that verifies it (file + test name) and run it to confirm it passes — do not mark an AC as PASS on the strength of manual inspection alone unless Step 2.6 explicitly classified it as `manual`. Record the result:

```
AC #1 — PASS: /my_tasks lists assignments for the calling volunteer
          → tests/bot-commands.test.ts::"/my_tasks lists assigned tasks"
AC #2 — PASS: empty-assignment case shows friendly message
          → tests/bot-commands.test.ts::"/my_tasks shows empty state"
AC #3 — PASS: npx ts-node scripts/check-command-parity.ts reports OK
AC #4 — PASS: npm test passes, 2 new tests added
```

**Gate: every AC must show a passing automated test reference, or an explicit `manual` classification carried over from Step 2.6.** If any AC has neither, implement and write the missing test before reporting done.

---

## Step 8 — Update living documentation

Once all acceptance criteria pass, update docs to reflect the completed work. Each update is its own commit if it touches real content; skip a doc if there is genuinely nothing new to record.

### 8a — Reference the issue for auto-close

Ensure the final commit message or PR body includes `Closes #<N>` (or `Part of #<N>` if this is one of several commits/PRs needed) so GitHub closes the issue automatically on merge.

### 8b — Update AGENTS.md / CLAUDE.md

Read [AGENTS.md](../../../AGENTS.md) and update only the sections affected by this work — a new architectural convention, a new shared constant/helper, a corrected fact. Do not rewrite sections that are still accurate. `CLAUDE.md` only needs a change if it diverges from AGENTS.md in something that's now stale (rare, since it mostly imports AGENTS.md).

```bash
git add AGENTS.md
git commit -m "docs(agents): reflect changes from issue #<N>"
```

### 8c — Update README.md / CONTRIBUTING.md

If the completed work changes user-facing behavior (a new command, a new setup step, a new prerequisite), update:
- README.md's "Commands Reference" section
- CONTRIBUTING.md's "Bot Commands" section

Skip entirely if nothing user-facing changed.

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs(readme): reflect changes from issue #<N>"
```

### 8d — Update env example files

If the implementation introduces, renames, or removes any environment variable, update **all three** example files to match — this repo has one per environment, not a single shared `.env.example`:

```bash
grep -l "" .env.local.example .env.staging.example .env.production.example
```

Add the new variable with a placeholder value and a one-line comment in each of the three files; remove ones that no longer exist. Never write a real secret into an example file. If no env vars changed, skip this step.

---

## Step 9 — Report

Summarise the work:

1. **Branch:** the branch name
2. **Commits:** list each commit hash + message (from `git log --oneline`)
3. **Tests added:** count and file(s)
4. **Command parity:** verified / not applicable
5. **Acceptance criteria:** all passed / any outstanding
6. **Docs updated:** which of AGENTS.md / README.md / CONTRIBUTING.md / `.env.*.example` were changed and why; which were skipped and why
7. **Next step:** what the human needs to do (e.g. "review and push", "test the wizard flow manually against a real bot")

Keep it under 20 lines. Do not repeat code that is already visible in the diff.

---

## Guardrails

- **Never** commit to `main` directly.
- **Never** use `git add -A` or `git add .` — always name specific files.
- **Never** use `--no-verify` to skip hooks.
- **Never** mark a task done if the full test suite (Step 6) is failing, or if `src/bot.ts`/`api/webhook.ts` are out of command parity.
- **Never** combine two logical changes into one commit.
- **Never** write a commit message that describes WHAT the code does instead of WHY it exists.
- If a pre-commit hook fails, fix the underlying issue and create a new commit — do NOT amend.

### .gitignore

If the implementation creates new build artefacts, temp files, secrets, or generated files that should not be tracked, update `.gitignore` in the same commit that introduces the pattern.

### Dependency vulnerabilities

If `package-lock.json` changed because a new dependency was added, run `npm audit` and address any advisory it reports for the new dependency specifically.
