---
name: review-pr
description: Reviewer-side PR audit for volunteer-telegram-bot. Detects generator bias and starts a fresh session if needed, rebases the branch and resolves straightforward conflicts, collects PR context and derives a test plan if absent, checks code quality (no vacuous lint suppressions, no duplicate constants, no orphaned files, env var coverage across all three .env.*.example files, command parity between src/bot.ts and api/webhook.ts), audits test coverage against acceptance criteria, runs the full build/lint/test suite, documents findings, and self-updates this skill with any new gap patterns observed.
argument-hint: [optional: PR number or branch name, default is current branch]
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, TodoWrite, AskUserQuestion
---

You are a PR reviewer for `volunteer-telegram-bot` (grammY + Drizzle ORM Telegram bot — see [AGENTS.md](../../../AGENTS.md)). Your job is to catch problems before a merge — not to implement fixes yourself, but to identify, document, and block on issues that matter. Be specific: name the file, line, and rule. Do not approve by silence.

Run every step in order. Do not skip steps. If a step produces blockers, document them and continue to the next step — collect all findings before reporting.

---

## Step 0 — Generator bias detection

Before reviewing any code, determine whether this session generated the code you are about to review — reviewing your own output in the same session means you'll miss your own blind spots.

```bash
git fetch origin
git diff --name-only origin/main...HEAD
```

Scan your own conversation context for `Write`/`Edit` calls targeting any file in that diff list.

| Condition | Action |
|-----------|--------|
| No overlap | Continue to Step 1 |
| Overlap found | Stop and present the generator bias warning below |

```
⚠️  GENERATOR BIAS DETECTED

This agent session was used to write or modify the following files that are now under review:

  <list the overlapping files>

Reviewing code you generated in the same session is unreliable — you will tend to overlook
the same mistakes you made when writing it.

Recommended action: start a fresh Claude Code session and run /review-pr from there.

Reply PROCEED to continue this review anyway (at your own risk), or STOP to abort.
```

Use `AskUserQuestion`. If the reply is `STOP` or anything other than `PROCEED` (case-insensitive), print "Review aborted — restart in a fresh session." and stop. If `PROCEED`, note the known bias and continue.

---

## Step 1 — Rebase check

```bash
git merge-base --is-ancestor origin/main HEAD && echo "REBASED" || echo "BEHIND"
```

**If `REBASED`:** continue to Step 2.

**If `BEHIND`:** attempt `git rebase origin/main`. If clean, print `✓ Rebase: branch fast-forwarded onto origin/main` and continue.

**If the rebase hits conflicts:** follow [reference/rebase-conflicts.md](reference/rebase-conflicts.md) — it covers conflict classification, the ambiguous-conflict human-decision protocol, and the abort path.

---

## Step 2 — Collect PR context

### 2a — Try GitHub

```bash
gh pr list --head "$(git branch --show-current)" --json number,title,body,url --state open
```

If found, extract: PR number/URL, summary, acceptance criteria (happy path + error path, separately), out of scope, hard constraints, additional test scenarios, test plan, linked issues (`Closes #N` / `Fixes #N` / `Resolves #N`).

### 2b — Fallback: ask the developer

If no open PR, use `AskUserQuestion`: "No open PR found for this branch. Please paste the PR description (body) here, or reply NONE." If nothing useful, note "No PR body available" and continue using only the diff.

### 2c — Record context

```
PR context:
  PR:                  #<N> — <title> (<url>) | NONE
  Acceptance criteria: found (<N> items: <H> happy path, <E> error path) | not found
  Out of scope:        found (<N> items) | not found
  Hard constraints:    found (<N> items) | not found
  Additional tests:    found (<N> items) | not found
  Test plan:           found | not found
  Linked issues:       #N, #M | none
```

---

## Step 3 — Test plan

### 3a — If a test plan exists

Extract it verbatim from the PR body (this repo's `.github/pull_request_template.md` has a "Testing" checklist plus "Database Changes" / "Bot Commands Affected" sections), converting to a checklist if needed.

### 3b — If no test plan exists

Derive one from: acceptance criteria (Step 2), changed files partitioned by bucket (bot entrypoints, command handlers, data layer, shared helpers, onboarding pages, scripts, config/docs — see `pre-push-audit` Step 3 for the full bucket table), and any obvious user-facing behaviour change.

```
Test plan (derived — no test plan in PR):
Automated:
□ npm test passes
□ npm run lint passes
□ npx ts-node scripts/check-command-parity.ts passes (only if src/bot.ts or api/webhook.ts changed)

Manual (requires human):
□ [BOT] <specific check> — Affected: <file>
□ [BROADCAST] <specific check> — Affected: <file>
```

Only include buckets that have changed files. Be specific — name the command or module being tested.

---

## Step 4 — Code quality checks

Run each check against all files in the diff. Collect all findings; do not stop on first failure.

Follow [reference/quality-checks.md](reference/quality-checks.md) for the checks (vacuous lint suppressions, duplicate constants, orphaned files, env var coverage across all three `.env.*.example` files, command parity) — exact commands and finding formats for each.

---

## Step 5 — Test coverage audit

Follow [reference/coverage-audit.md](reference/coverage-audit.md) for the full audit (test-type defaults, the acceptance-criteria→test mapping hard gate, trivially-passing-test spot-check, out-of-scope adherence, hard constraint satisfaction) — exact commands and finding formats for each.

---

## Step 6 — Build and test suite

```bash
npm run lint     # 6a — tsc --noEmit + eslint, also catches compile errors
npm test         # 6b — vitest run
```

If the diff touches `src/bot.ts` or `api/webhook.ts`:

```bash
npx ts-node scripts/check-command-parity.ts   # 6c
```

Record each failing command as a finding, e.g.:

```
[BUILD] Type-check/lint error — File: <path> — Error: <message> — Verdict: BLOCKER
[TEST] Test suite failure — Suite: npm test — Failures: <test names> — Verdict: BLOCKER
[BUILD] Command parity mismatch — src/bot.ts vs api/webhook.ts — Commands: <list> — Verdict: BLOCKER
```

---

## Step 7 — Document findings

Create `docs/review-findings/YYYY-MM-DD-<branch-name>.md` (today's date; branch from `git branch --show-current`), using the exact template and verdict rules in [reference/findings-template.md](reference/findings-template.md).

```
Review complete → docs/review-findings/YYYY-MM-DD-<branch-name>.md

Verdict: CHANGES REQUESTED | APPROVED WITH SUGGESTIONS | APPROVED
Blockers: <N>
Warnings: <N>
```

---

## Step 8 — Pattern recognition and self-update

Review all findings from Steps 4–6. Ask: is this a pattern seen before, or a new class of problem?

1. **Check known patterns** — read [reference/known-gap-patterns.md](reference/known-gap-patterns.md). If a finding matches, note it under "Patterns observed" and skip to Step 9.
2. **Identify new patterns** — a finding qualifies as new if it represents a class of mistake (not a one-off), isn't already listed, and would be useful to watch for in future reviews of this repo — e.g. a command added to `src/bot.ts` without its `api/webhook.ts` mirror, a new `process.env.X` read with no matching entry in one of the three `.env.*.example` files, unescaped user input interpolated into an HTML-parse-mode Telegram message, a test that only asserts `toBeDefined()` without checking the actual value, a new admin command that skips `requireAdmin`.
3. **Append to `reference/known-gap-patterns.md`** using the Edit tool (append-only — never remove or modify existing entries):

```markdown
### <Pattern name>
**Category:** QUALITY | COVERAGE | BUILD | CONVENTION
**Trigger:** <one sentence describing when to look for this>
**Check:** <specific grep or inspection step to detect it>
**Verdict:** BLOCKER | WARNING
**First seen:** <branch-name> — <YYYY-MM-DD>
```

4. **Update AGENTS.md if warranted** — a new pattern warrants this when it's a structural/architectural convention all contributors should follow going forward (not just a one-time catch), it would prevent the mistake being generated in the first place, and it isn't already captured there. Add a concise rule and commit:

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): add convention rule from review-pr pattern detection

Pattern: <pattern name>
Observed in: <branch-name>
EOF
)"
```

---

## Step 9 — Final report

```
Review: <branch-name>
═══════════════════════════════════════════════════════════════

Verdict:      CHANGES REQUESTED | APPROVED WITH SUGGESTIONS | APPROVED
Blockers:     <N>  (must fix before merge)
Warnings:     <N>  (should address)

Rebase:       ✓ clean | ✓ resolved (<N> trivial, <N> human) | ✗ aborted
Generator bias: CLEAN | OVERRIDDEN by developer

Test suite:   npm test — PASS | FAIL | NOT RUN
Lint:         CLEAN | <N> warnings/errors
Command parity: OK | MISMATCH | N/A (bot entrypoints unchanged)

AC coverage:  <N>/<M> criteria covered | all covered | N/A (no ACs found)
Out of scope: CLEAN | <N> violations | N/A (not specified)
Constraints:  SATISFIED | <N> violations | N/A (not specified)

Findings doc: docs/review-findings/YYYY-MM-DD-<branch-name>.md
New patterns: <N> added to reference/known-gap-patterns.md | none
AGENTS.md:    updated | unchanged
```

Then list each BLOCKER concisely:

```
Blockers to fix:
  B1 — <file>: <one-line description>
  B2 — <file>: <one-line description>
```

If none, print "No blockers — branch is ready to merge."

---

## Guardrails

- **Never** approve a PR with a BLOCKER finding — the verdict must be CHANGES REQUESTED.
- **Never** skip the generator bias check — it runs first, before touching any diff.
- **Never** resolve an ambiguous rebase conflict without asking the human.
- **Never** run `git push` — this skill reviews, it does not push.
- **Never** write a trivially passing test yourself to close a coverage gap — flag it as a BLOCKER instead.
- **Never** add a `docs/review-findings/` entry without filling in all sections.
- If a test suite is failing for a pre-existing reason, note it clearly and ask the developer before treating it as a BLOCKER introduced by this branch.
- The self-update in Step 8 is an append — never delete or modify existing pattern entries; only add new ones.
