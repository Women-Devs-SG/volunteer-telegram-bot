# Code quality checks (Step 4)

Run each check against all files in the diff. Collect all findings; do not stop on first failure.

## 4a — Vacuous lint suppressions

```bash
git diff origin/main...HEAD -- '*.ts' '*.tsx' | grep '^\+' | grep -E 'eslint-disable|@ts-ignore|@ts-expect-error|as any'
```

For each suppression/escape-hatch added, verify it isn't silencing a real bug rather than a genuinely unavoidable case:

```
[QUALITY] Lint/type-check suppressed
  File:   <path>
  Line:   <location>
  Rule:   <which eslint rule is disabled, or "as any"/"@ts-ignore">
  Risk:   Suppressing lints/types hides real bugs. Prefer fixing the root cause or narrowing the type.
  Verdict: BLOCKER — remove the suppression or justify it explicitly in the PR.
```

## 4b — Duplicate constants

Check whether a literal in the diff already exists as a named constant elsewhere in `src/`:

```bash
grep -rn "^const \|^export const " src/ 2>/dev/null
```

```
[QUALITY] Duplicate constant
  File:    <path-in-diff>
  Value:   <literal value>
  Already defined in: <existing-file>:<constant-name>
  Verdict: BLOCKER — import the shared constant instead of re-declaring.
```

## 4c — Orphaned files

For each **new file** added (not modified), check whether it's actually imported anywhere:

```bash
grep -rln "<module-name-without-extension>" --include="*.ts" src/ api/ | grep -v "<new-file>"
```

```
[QUALITY] Orphaned file
  File:    <path>
  Status:  Added but not imported anywhere in src/ or api/.
  Verdict: WARNING — confirm this file is intentional and will be wired up, or delete it.
```

## 4d — Environment variable coverage

```bash
git diff origin/main...HEAD -- '*.ts' '*.tsx' | grep '^\+' | grep -oE "process\.env\.[A-Z_]+" | sort -u
```

For each `VAR_NAME` found, check it appears in **all three** environment example files — this repo has one per deployment target, not a single shared `.env.example`:

```bash
for f in .env.local.example .env.staging.example .env.production.example; do
  grep -q "VAR_NAME" "$f" || echo "MISSING from $f"
done
```

```
[QUALITY] Missing env var documentation
  Variable: <VAR_NAME>
  Used in:  <file>
  Missing from: <.env.local.example | .env.staging.example | .env.production.example — list all that are missing it>
  Verdict: BLOCKER — add VAR_NAME= with a placeholder value and a comment to every file that's missing it.
```

## 4e — Command parity

```bash
git diff --name-only origin/main...HEAD | grep -E '^(src/bot\.ts|api/webhook\.ts)$'
```

If either file changed, run the parity script rather than eyeballing the diff — command registration lines are easy to miss in a large diff:

```bash
npx ts-node scripts/check-command-parity.ts
```

```
[QUALITY] Command parity mismatch
  Missing/extra: <command name(s) from the script's output>
  File:    src/bot.ts vs api/webhook.ts
  Verdict: BLOCKER — the bot will behave differently in local/staging vs. production until this is fixed.
```

If neither file changed, note "Command parity: bot entrypoints unchanged — skipping." and continue.
