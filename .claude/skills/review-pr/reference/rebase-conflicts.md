# Rebase conflict resolution (Step 1)

Classify each conflicted file:

| Conflict type | Condition | Action |
|---------------|-----------|--------|
| **Trivial** | One side added entirely new lines with no overlap | Accept both sides |
| **Formatting-only** | Only whitespace/import-order differs | Accept the branch version (it came last) |
| **Unambiguous** | One side deleted a line the other didn't touch, or a pure addition that doesn't conflict | Resolve deterministically; log the decision |
| **Ambiguous** | Both sides changed the same logic | Stop, show the conflict, ask the human |

For each **ambiguous conflict**, use `AskUserQuestion`:

```
Rebase conflict — human decision required

File: <path>
Conflict:
<<<<<<< HEAD (main)
<main side>
=======
<branch side>
>>>>>>> <sha> (<branch-name>)

Context: <one sentence>
Which version should win, or how should the two sides be merged?
Reply with: MAIN | BRANCH | <custom resolution>
```

Apply the resolution, `git add <file>`, `git rebase --continue`. If the human replies `ABORT`, run `git rebase --abort` and stop:

```
✗ REVIEW BLOCKED — rebase aborted at developer request.
Resolve the conflicts manually, then re-run /review-pr.
```

After all conflicts resolve, print:

```
✓ Rebase complete
  Trivial conflicts resolved automatically: <N>
  Conflicts resolved with human input: <N>
```
