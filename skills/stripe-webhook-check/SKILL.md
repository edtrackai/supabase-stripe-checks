---
name: stripe-webhook-check
description: Check Next.js Stripe webhook handlers for missing signature verification, JSON parsed before verification, missing idempotency, Edge runtime, and hard-coded webhook secrets. Use when the user asks to check or review a Stripe webhook, or before taking payments live.
argument-hint: "[path-to-repo]"
allowed-tools: Bash(node *), Read, Grep, Glob
---

# stripe-webhook-check

Run the checker on the repo (default: the current directory):

```bash
node "${CLAUDE_SKILL_DIR}/check-webhook.mjs" $ARGUMENTS
```

Then:
1. Open each handler it lists and confirm every finding at the reported line. Drop false positives and say why (for example, idempotency handled in a helper the regex didn't see).
2. Also read the handler and check by hand that:
   - access is granted from `checkout.session.completed` / `customer.subscription.*` events, not from the success page;
   - the event's customer or `client_reference_id` maps to the right user;
   - non-2xx responses are only returned for real failures, because Stripe retries them.
3. Report a table: severity, check, `file:line`, fix. Show a corrected handler snippet if W1 or W2 fired.
4. Never print a secret value. Do not edit files unless the user asks.

What this does not cover: client-chosen prices, keys leaked into client bundles, RLS on the billing tables. The paid Launch Audit plugin checks those (see the README).
