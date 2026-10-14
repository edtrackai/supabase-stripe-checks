---
name: rls-check
description: Check Supabase SQL migrations for row-level security gaps (tables without RLS, using (true) policies, anon write access, missing with check, unsafe security definer functions). Use when the user asks to check RLS, Supabase policies, or database security before launch.
argument-hint: "[path-to-repo]"
allowed-tools: Bash(node *), Read, Grep, Glob
---

# rls-check

Run the checker on the repo (default: the current directory):

```bash
node "${CLAUDE_SKILL_DIR}/check-rls.mjs" $ARGUMENTS
```

Then:
1. For each finding, open the file at the reported line and confirm it is real. Drop false positives and say why. A `using (true)` on a genuinely public, read-only `select` policy can be fine if a comment says so.
2. Report a table: severity, check, `file:line`, and the exact SQL fix (a new migration, never an edit to an applied one).
3. If no `.sql` files exist, tell the user to run `supabase db pull` so the schema is in the repo, then re-run.
4. Do not edit files or run SQL against any database unless the user asks. Suggest fixes as a new migration file.

What this does not cover: auth code, storage policies, service-role usage, and IDOR in your app code. The paid Launch Audit plugin checks those (see the README).
