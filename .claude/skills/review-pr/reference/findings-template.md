# Findings doc template and verdict rules (Step 7)

Create `docs/review-findings/YYYY-MM-DD-<branch-name>.md` (today's date; branch from `git branch --show-current`).

```markdown
# Review: <branch-name>
Date: YYYY-MM-DD
Reviewer: AI (review-pr skill) — session bias: CLEAN | GENERATOR BIAS (developer overrode)
PR: #<N> <url> | NONE

## Verdict
APPROVED | APPROVED WITH SUGGESTIONS | CHANGES REQUESTED

## Summary
<2–3 sentences: what the PR does, main risk areas>

## Blockers (must fix before merge)
### B1 — <short title>
- **Type:** QUALITY | COVERAGE | BUILD | TEST | SCOPE | CONSTRAINT
- **File:** <path>
- **Finding:** <description>
- **Fix:** <specific remediation>

## Warnings (should address)
### W1 — <short title>
- **Type:** QUALITY | COVERAGE
- **File:** <path>
- **Finding:** <description>
- **Suggestion:** <specific suggestion>

## Suggestions (optional improvements)

## Test plan verification
| Item | Status | Notes |
|------|--------|-------|
| npm test passes | PASS / FAIL / NOT RUN | |
| npm run lint passes | PASS / FAIL / NOT RUN | |
| Command parity (src/bot.ts vs api/webhook.ts) | PASS / FAIL / N/A | |

## Acceptance criterion coverage
| Criterion | Type | Test file | Status |
|-----------|------|-----------|--------|
| <AC text> | happy path / error path / additional | <test file or MISSING> | COVERED / MISSING |

## Out-of-scope adherence
<!-- CLEAN, or list violations. N/A if none specified. -->

## Hard constraint satisfaction
<!-- SATISFIED / VIOLATED per constraint, with evidence. N/A if none specified. -->

## Patterns observed
<!-- Reserved for Step 8 -->
```

## Verdict rules

| Condition | Verdict |
|-----------|---------|
| Zero BLOCKER, zero WARNING | APPROVED |
| Zero BLOCKER, ≥ 1 WARNING | APPROVED WITH SUGGESTIONS |
| ≥ 1 BLOCKER | CHANGES REQUESTED |
