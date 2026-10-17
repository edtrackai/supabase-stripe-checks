# supabase-stripe-checks

Two free, read-only Claude Code checks for Next.js + Supabase + Stripe apps. They target the two bugs AI agents ship most often:

- **`rls-check`**: finds row-level security gaps in your Supabase migrations.
- **`stripe-webhook-check`**: finds Stripe webhook handlers anyone can fake.

Zero dependencies. Nothing is edited and no database is touched. MIT licensed.

## Install

In Claude Code:

```
/plugin marketplace add edtrackai/supabase-stripe-checks
/plugin install supabase-stripe-checks@stack-and-ship
```

Then ask "check my RLS" or "review my Stripe webhook", or run:

```
/supabase-stripe-checks:rls-check
/supabase-stripe-checks:stripe-webhook-check
```

Claude runs the checker, opens every flagged line to rule out false positives, and gives you a table of `file:line` findings with the fix.

No Claude Code? The checkers are plain Node 18+ scripts:

```bash
node skills/rls-check/check-rls.mjs path/to/app
node skills/stripe-webhook-check/check-webhook.mjs path/to/app --fail-on=high   # exit 1 in CI
```

## What it checks

| ID | Severity | Check |
|---|---|---|
| R1 | critical | Table created without `enable row level security` |
| R2 | critical | `using (true)` / `with check (true)` policy |
| R3 | high | Insert/update/delete policy granted to `anon` or `public` |
| R4 | high | Insert/update policy with no `with check` |
| R5 | high | `security definer` function without `set search_path` |
| W1 | critical | Webhook never calls `constructEvent` (no signature check) |
| W2 | critical | `request.json()` before verification (signature can't be checked) |
| W3 | high | No idempotency (`event.id` never recorded, so retries double-grant), or dedupe that isn't status-aware: duplicates skipped with no `pending`/`completed` state (incl. claim-then-delete), so a failed or crashed event is lost |
| W4 | medium | Webhook on the Edge runtime |
| W5 | medium | `whsec_` secret hard-coded (redacted in output) |

Tested: every check fires on `tests/fixtures/bad`. There are zero findings on `tests/fixtures/good` and on our Next.js + Supabase + Stripe reference app. Run `npm run verify`.

## Limits

These are pattern checks, not a full audit. They read `.sql` files in the repo, so run `supabase db pull` if your schema only lives in the dashboard. They don't cover:
- auth code (`getSession()` on the server, unprotected Server Actions);
- service-role keys in client bundles;
- client-chosen prices;
- storage policies;
- IDOR.

## Want the rest?

*Ad: the Launch Audit and Ship-Ready AI Rules links below are paid products from the same author (Stack & Ship). This plugin stays free and MIT-licensed.*

- **[Free Supabase + Stripe Security Checklist](https://luxurydrive0.gumroad.com/l/security-checklist?utm_source=github&utm_medium=readme&utm_campaign=sprint1&utm_content=supabase-stripe-checks)** (20 checks, PDF): the manual version of these checks and more.
- **[Launch Audit](https://edtrackai.github.io/launch-audit?utm_source=github&utm_medium=readme&utm_campaign=sprint1&utm_content=supabase-stripe-checks)**: covers what these two checks don't, including service-role keys in client bundles, client-chosen prices, and (as manual-review items) storage policies and IDOR.
- **[Ship-Ready AI Rules](https://luxurydrive0.gumroad.com/l/ffjsf?utm_source=github&utm_medium=readme&utm_campaign=sprint1&utm_content=supabase-stripe-checks)**: rules that help Cursor and Claude Code avoid writing these bugs in the first place.

Made by [Stack & Ship](https://edtrackai.github.io?utm_source=github&utm_medium=readme&utm_campaign=sprint1&utm_content=supabase-stripe-checks): tested kits for people who ship. Issues and PRs welcome.

## License

MIT. See [LICENSE](LICENSE). Not affiliated with Anthropic, Supabase, or Stripe.
