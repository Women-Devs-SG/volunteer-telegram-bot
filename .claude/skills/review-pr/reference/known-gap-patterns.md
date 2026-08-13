# Known Gap Patterns

Populated by Step 8 as patterns are observed in real `volunteer-telegram-bot` reviews. Append-only —
never remove or modify existing entries; only add new ones via the Edit tool.

<!-- Entries are appended here by the skill -->

### Command registered in src/bot.ts but not mirrored in api/webhook.ts
**Category:** BUILD
**Trigger:** A PR adds, removes, or renames a `bot.command('...')` call in `src/bot.ts` (the long-polling entrypoint used locally/staging) without making the identical change in `api/webhook.ts` (the Vercel serverless entrypoint used in production).
**Check:** `npx ts-node scripts/check-command-parity.ts` — it diffs the `bot.command('...')` calls between the two files and exits non-zero on any mismatch. Run it whenever either file appears in the diff.
**Verdict:** BLOCKER — production (webhook) and local/staging (long-polling) will silently diverge in which commands respond.
**First seen:** seeded at skill setup — 2026-08-13

### New process.env var documented in only one of the three .env.*.example files
**Category:** COVERAGE
**Trigger:** A PR reads a new `process.env.X` and adds it to only one of `.env.local.example` / `.env.staging.example` / `.env.production.example` (often just the one the author is actively using), rather than all three — this repo has no single shared `.env.example`.
**Check:** `grep -oE "process\.env\.[A-Z_]+" <changed-file>` for each new variable, then `grep "VAR_NAME"` across all three example files.
**Verdict:** BLOCKER — whoever sets up the environment the author didn't touch has no documentation the variable exists.
**First seen:** seeded at skill setup — 2026-08-13

### User-controlled text interpolated into an HTML-parse-mode message without escaping
**Category:** QUALITY
**Trigger:** A handler sends a message with `parse_mode: 'HTML'` (or grammY's HTML-mode helper) and interpolates a volunteer name, Telegram handle, or other user-supplied free text directly into the string, without passing it through `escapeHtml` (`src/utils.ts`).
**Check:** For each changed `ctx.reply(...)`/`bot.api.sendMessage(...)` call using HTML parse mode, trace each interpolated variable back to its source — if it ever came from a Telegram update (name, handle, message text) rather than a hardcoded string or a value already escaped upstream, flag it.
**Verdict:** BLOCKER if the value is attacker-controlled (any Telegram user can set their own display name/bio); a crafted name like `<b>` or `&lt;script&gt;`-style payloads can break message rendering or, in edge cases, get reflected elsewhere.
**First seen:** seeded at skill setup — 2026-08-13
