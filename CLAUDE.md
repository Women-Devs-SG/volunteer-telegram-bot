# CLAUDE.md

@AGENTS.md

The above file is the primary reference for this repo's architecture, commands, testing, and conventions — read it before making changes. Everything below is Claude Code-specific on top of it.

## Skills available in this repo

`.claude/skills/` has four workflow skills for the issue → implement → push → review lifecycle:

- **create-issue** — draft and file a new GitHub issue matching this repo's issue-template conventions (`.github/ISSUE_TEMPLATE/*.yml`), plus an Acceptance Criteria section for `implement-issue` to consume.
- **implement-issue** — implement a change from an issue/prompt: branch, derive acceptance criteria and a test plan, implement in atomic commits, verify command parity (`src/bot.ts` vs `api/webhook.ts`) when bot commands change, update docs.
- **pre-push-audit** — gate before `git push`: rebase check, commit-message convention check, test coverage audit, human-testing checklist for anything not automatable, PR template generation.
- **review-pr** — reviewer-side audit: generator-bias check, rebase, code-quality checks, coverage audit against acceptance criteria, full test/lint run, findings doc, self-updating known-gap-patterns list.

Use them via `/create-issue`, `/implement-issue`, `/pre-push-audit`, `/review-pr`. They assume the npm-based Vitest/ESLint toolchain described in AGENTS.md, not any other stack.
