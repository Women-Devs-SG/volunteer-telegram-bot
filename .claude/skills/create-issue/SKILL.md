---
name: create-issue
description: Drafts and files a new GitHub issue for the volunteer-telegram-bot repo (Women-Devs-SG), matching the repo's existing issue-form conventions (bug_report / feature_request / improvement) and adding an Acceptance Criteria section that implement-issue later consumes, with repo-convention title/labels, added to a GitHub Project board if one exists, then wires up blocked-by/blocks relationships via GitHub's issue-dependency GraphQL API. Use when the user wants to file, open, create, or write up a new GitHub issue, bug report, feature request, or backlog item for this project — including turning a Slack message, design doc, or spoken description into a properly-formatted issue.
argument-hint: [issue description, or path to a spec/doc to base it on]
allowed-tools: Read, Grep, Glob, Bash, TodoWrite, AskUserQuestion
---

You are drafting and filing a new GitHub issue for the `volunteer-telegram-bot` repo (Telegram bot for Women Devs SG, built with grammY + Drizzle ORM — see [AGENTS.md](../../../AGENTS.md) for architecture). The output must be immediately consumable by the `implement-issue` skill later, so the body's section headings matter as much as the content. Follow every step in order.

## Arguments

`$ARGUMENTS` contains either:
- Raw issue content (title, description, acceptance criteria — as much or as little as the user has)
- A file path to a spec, design doc, or notes to base the issue on (read it with Read)
- A one-line description of a problem or feature to file

If `$ARGUMENTS` is empty, ask the user what the issue is about before proceeding.

---

## Step 1 — Gather repo conventions before drafting

Pull the live conventions this repo actually uses — do not rely on memorized examples, they drift.

```bash
# Precedent for title format and recency
gh issue list --state all --limit 10 --json number,title,labels

# Full label list (only use labels that exist — never invent a new one silently)
gh label list

# Is there a project board to file this onto? (this repo has none as of writing, but check live)
gh project list --owner Women-Devs-SG --format json --jq '.projects[] | {number,title}'
```

Note the title style from the last 10 issues and the exact label spelling/casing available. This repo's `.github/ISSUE_TEMPLATE/` has three form templates — `bug_report.yml` (label `bug`, title `bug: <short description>`), `feature_request.yml` (label `enhancement`, title `feat: <short description>`), `improvement.yml` (title `improve: <short description>` — note there is currently **no** `improvement` label in `gh label list`; if you pick this type, leave it unlabeled rather than inventing one, per the guardrails below). Read whichever template matches the issue type before drafting — its field order is the section skeleton to follow.

---

## Step 2 — Pick the issue type and derive content

Decide which of the three templates fits, based on the user's description:

| Type | When | Title prefix | Label (if it exists) |
|------|------|---------------|------------------------|
| Bug | Something is broken or behaves incorrectly | `bug: ` | `bug` |
| Feature | New capability that doesn't exist yet | `feat: ` | `enhancement` |
| Improvement | Existing behavior should change/align, no new capability | `improve: ` | none currently — leave unlabeled |

If the issue is really tooling/CI/docs/refactor work that doesn't fit any of the three forms, it's fine to skip the form-specific sections below and go straight to a plain description plus the shared sections in Step 2.5 — use `chore:`, `docs:`, `refactor:`, or `test:` as the title prefix instead.

Extract or derive each field for the chosen type. If the user supplied a field explicitly, use it verbatim — do not paraphrase it away. If a field is missing, derive it from context (repo structure, related docs, the rest of the description).

### Bug (`bug_report.yml` fields)

| Field | Derive from |
|-------|-------------|
| **Summary** | One concise sentence |
| **Steps to reproduce** | Numbered list; if the user didn't give exact steps, derive the most plausible ones from context and mark inferred steps as such |
| **Expected behavior** | What should happen |
| **Actual behavior** | What happens instead — include the exact error message/log line if one was given |
| **Environment** | "Local development (PGlite)", "Production (PostgreSQL)", or "Other / Not sure" |

### Feature (`feature_request.yml` fields)

| Field | Derive from |
|-------|-------------|
| **Summary** | One concise sentence |
| **Motivation / Problem** | Why this matters, what's missing today |
| **Proposed solution** | Concrete approach, numbered if multi-step |
| **Alternatives considered** | Other approaches, or "None considered" |
| **Scope** | Checkbox-style: backward compatible? requires database changes? requires documentation updates? |

### Improvement (`improvement.yml` fields)

| Field | Derive from |
|-------|-------------|
| **Summary** | One concise sentence |
| **Current behavior** | What happens today |
| **Desired behavior** | What it should look like after |
| **Proposed changes** | Numbered list of concrete changes |
| **Scope** | Checkbox-style: affects user-visible messages? requires test updates? requires documentation updates? |

---

## Step 2.5 — Shared sections (always add, regardless of type)

`implement-issue` and `pre-push-audit` key off these exact headings — **always emit every one**, even when the answer is "None" or "None stated," so a missing section reads as "intentionally empty" rather than "not derivable."

```markdown
## Acceptance criteria

### Happy path
**Given** <precondition>
**When** <action — e.g. a volunteer runs /my_tasks>
**Then** <observable outcome — an exact bot reply, a database state, an exit code>

### Error path / edge case
**Given** <precondition>
**When** <action>
**Then** <observable outcome>

## Out of scope
- <item, or "None stated">

## Technical context
<files/commands/schema affected — grep to confirm paths are real before citing them; note explicitly if this touches both `src/bot.ts` and `api/webhook.ts` (command parity, see AGENTS.md)>

## Additional test scenarios
- <edge case beyond the acceptance criteria, or "None beyond the acceptance criteria above">

## Hard constraints
- <non-negotiable requirement — e.g. "must not break command parity between src/bot.ts and api/webhook.ts", or "None stated beyond project defaults">

## Dependency issues
- None
```

Each acceptance criterion must be falsifiable — "the bot works" is not acceptable; "`/my_tasks` replies with a list of the caller's assigned tasks, or 'No tasks assigned' if empty" is.

---

## Step 3 — Title and labels

**Title:** `<prefix>: <imperative summary>` per the table in Step 2, matching the closest precedent from Step 1's `gh issue list` output.

**Labels:** choose only from the live list fetched in Step 1 (`gh label list`):

| Signal | Label |
|--------|-------|
| Bug report | `bug` |
| New capability | `enhancement` |
| Docs-only change | `documentation` |
| Straightforward, well-scoped, good for a new contributor | `good first issue` |
| Not ready to be worked on yet / needs triage | `pending-review` |
| Explicitly reserved for a women-developer contributor per the repo's mission | `women-devs-only` (only if the user says so explicitly — never infer this) |
| Suitable for Hacktoberfest | `hacktoberfest` |

If nothing in the live label list fits (e.g. the `improvement` type from Step 2), leave the issue unlabeled rather than inventing a label — never run `gh label create` without asking the user first.

---

## Step 4 — Detect dependency relationships

Scan the user's input for reference patterns:

- Backward (this issue is blocked): `blocked by #N`, `depends on #N`, `requires #N`, `after #N is done`, `needs #N`
- Forward (this issue blocks another): `blocks #N`, `unblocks #N`, `must land before #N`

Collect all referenced numbers into BLOCKED_BY and BLOCKS lists (either may be empty). For each number referenced, sanity-check it exists and skim its title:

```bash
gh issue view <N> --json number,title,state
```

If a referenced issue doesn't exist or is already closed for an unrelated reason, flag it in your draft preview (Step 5) rather than silently dropping it.

---

## Step 5 — Preview and confirm

Creating a GitHub issue is visible to the rest of the team, so confirm before filing. Show the user:

```
Title:  <title>
Labels: <label1>, <label2>, ... (or "none")
Blocked by: #N, #M (or "none")
Blocks:     #N (or "none")

--- body ---
<full rendered body>
```

Ask the user to confirm, edit, or cancel (AskUserQuestion: "Create issue as drafted" / "Let me edit something first" / "Cancel"). Do not run `gh issue create` until confirmed.

---

## Step 6 — Create the issue

Write the body to a scratch file first — heredocs and `--body` shell-escaping are unreliable for multi-paragraph Markdown with backticks and quotes.

```bash
cat > /tmp/issue-body.md <<'ISSUE_BODY_EOF'
<full body from Steps 2 and 2.5>
ISSUE_BODY_EOF

gh issue create \
  --title "<title>" \
  --body-file /tmp/issue-body.md \
  --label "<label1>" --label "<label2>"

rm -f /tmp/issue-body.md
```

`gh issue create` prints the new issue's URL — extract the trailing number as NEW_NUMBER.

---

## Step 7 — Add to a project board, if one exists

Only run this step if Step 1's `gh project list` returned at least one project. If it returned none, print "No GitHub Project board found for Women-Devs-SG — skipping." and continue to Step 8.

If a project exists, ask the user which one and which status/column to place it in (AskUserQuestion) rather than guessing — do not hardcode a project name, since none exists as a convention yet:

```bash
PROJECT_NUMBER=<from user selection>
gh project item-add "$PROJECT_NUMBER" --owner Women-Devs-SG --url "<issue-url>"
```

If this fails (missing `project` scope on the authenticated `gh` account), don't fail the whole run — the issue is already filed via Step 6. Report that the project step failed and why.

---

## Step 8 — Wire up dependency relationships

Only run this step if BLOCKED_BY or BLOCKS from Step 4 is non-empty.

```bash
NEW_ID=$(gh issue view $NEW_NUMBER --json id --jq .id)
```

For each `N` in BLOCKED_BY (this new issue is blocked by `N`):

```bash
BLOCKER_ID=$(gh issue view $N --json id --jq .id)
gh api graphql -f query='
  mutation($issue:ID!,$blocker:ID!){
    addBlockedBy(input:{issueId:$issue,blockingIssueId:$blocker}){clientMutationId}
  }' -f issue="$NEW_ID" -f blocker="$BLOCKER_ID"
```

For each `N` in BLOCKS (this new issue blocks `N`, i.e. `N` depends on the new issue — set the relationship on the dependent, `N`):

```bash
DEPENDENT_ID=$(gh issue view $N --json id --jq .id)
gh api graphql -f query='
  mutation($issue:ID!,$blocker:ID!){
    addBlockedBy(input:{issueId:$issue,blockingIssueId:$blocker}){clientMutationId}
  }' -f issue="$DEPENDENT_ID" -f blocker="$NEW_ID"
```

If a mutation errors (e.g. the issue-dependencies API isn't enabled for this repo), don't fail the whole run — report which links failed to wire and why, so the user can add them manually in the GitHub UI.

---

## Step 9 — Report

Summarize in under 10 lines:

1. **Issue:** number + URL
2. **Title / labels applied**
3. **Project:** added to `<project>` (or "no project board exists / not added")
4. **Dependency links wired:** which succeeded, which failed and why (if any)

---

## Guardrails

- **Never** run `gh issue create` before the user confirms the preview in Step 5.
- **Never** invent a label that doesn't already exist in `gh label list` — ask the user first if a new one seems warranted.
- **Never** apply `women-devs-only` unless the user explicitly asked for it.
- **Never** silently drop a referenced dependency issue that doesn't exist — surface it.
- **Never** assign the issue to anyone at creation time — assignment happens when work starts, not at filing time.
- **Never** close or edit any *other* issue as a side effect of this skill.
- If `gh` reports an auth error, stop and tell the user to run `gh auth login` — do not attempt workarounds.
