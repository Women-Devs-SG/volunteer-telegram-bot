# Test coverage audit (Step 5)

## 5a — Identify source files changed

```bash
git diff --name-only origin/main...HEAD | grep -v '^tests/' | grep -E '\.tsx?$'
```

## 5b — Check for corresponding test files

Use this default (per [AGENTS.md](../../../../AGENTS.md)'s Testing section), unless a more specific project doc says otherwise:

| Condition | Required test type | Location |
|-----------|--------------------|----------|
| New/changed bot command handler | Test mocking `DrizzleDatabaseService` | `tests/bot-commands.test.ts` |
| New/changed `DrizzleDatabaseService` method or schema change | Test against PGlite | `tests/database.test.ts` |
| Pure helper function (`src/utils.ts`, `src/parse-topic-link.ts`, etc.) | Unit test | `tests/<matching-name>.test.ts` |
| Command added/removed/renamed in `src/bot.ts` or `api/webhook.ts` | Parity check | `npx ts-node scripts/check-command-parity.ts` (not a Vitest test, but still a required gate) |
| Onboarding HTML page / docs / config-only | No test required | — |

## 5c — Acceptance criteria → automated test mapping (hard gate)

**Every acceptance criterion from the issue — happy path, error path, and additional test scenario — must map to at least one automated test that can falsify it.** This is a hard gate, not a suggestion. For each AC from Step 2, search for a test that exercises it:

```bash
grep -rn "<keyword from AC>" tests/
```

For each AC with no corresponding automated test, and no explicit note in the PR that it's a genuinely non-automatable manual-only scenario (Telegram UI rendering, real-device behavior):

```
[COVERAGE] Acceptance criterion not covered by an automated test
  AC:      <criterion text — happy path / error path / additional scenario>
  Gap:     No test exercises this specific path, and it isn't flagged as manual-only.
  Verdict: BLOCKER — add a test that can falsify this criterion before merging.
```

If an AC is legitimately manual-only, confirm it appears in the PR's manual verification checklist (Step 3) instead of silently passing it — an AC that is neither tested nor on the manual checklist is always a BLOCKER.

## 5d — Test quality spot-check

```bash
grep -n 'expect(true)\.toBe(true)\|\.toBeDefined()\s*;\?\s*$\|\.not\.toThrow()\s*;\?\s*$' <test-file>
```

An assertion that passes regardless of the implementation (e.g. `expect(true).toBe(true)`, or checking only `.toBeDefined()` when the actual value matters) is a gap:

```
[COVERAGE] Trivially passing test
  File:  <test-file>
  Line:  <N>
  Issue: Assertion does not verify behaviour — will pass even if implementation is broken.
  Verdict: WARNING — replace with a behavioural assertion against the specific expected value.
```

Also check that mocked dependencies (`vi.mock('../src/db-drizzle')`) actually assert on how the mock was called (`expect(mockFn).toHaveBeenCalledWith(...)`) rather than only asserting the command didn't throw.

## 5e — Out-of-scope adherence check

If "Out of scope" items were extracted in Step 2, check the diff for signs any were implemented anyway (new command handlers, new fields, new imports matching the scoped-out feature):

```
[SCOPE] Out-of-scope feature implemented
  Item:    <text>
  Found:   <file>:<line> — <description>
  Verdict: BLOCKER — remove this change; it was explicitly excluded from the issue scope.
```

If none were found in Step 2, note "Out of scope: not specified — skipping check."

## 5f — Hard constraint satisfaction check

For each constraint from Step 2, derive a specific check:

| Constraint type | Check approach |
|-----------------|-----------------|
| Command parity | `npx ts-node scripts/check-command-parity.ts` |
| Env var naming/documentation | `grep -n "process\.env\." <changed-files>`, then confirm each var appears in `.env.local.example`, `.env.staging.example`, and `.env.production.example` |
| Admin authorization | Confirm any new admin-only command calls `requireAdmin` rather than an ad hoc check |
| HTML escaping | Confirm user-controlled text interpolated into an HTML-parse-mode message is passed through `escapeHtml` |
| Schema/type consistency | Diff `src/schema.ts` changes against `src/types.ts`'s hand-maintained interfaces |

```
[CONSTRAINT] Hard constraint violated
  Constraint: <text>
  Violation:  <file>:<line> — <description>
  Verdict:    BLOCKER — the constraint is non-negotiable; fix before merging.
```

If none were found in Step 2, note "Hard constraints: not specified — skipping check."
