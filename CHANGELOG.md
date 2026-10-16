# Changelog

## 1.0.3 (2026-10-16)
- `npm test` (and so `npm run verify`) now names the test file directly instead of a quoted glob, which Node 20's `node --test` did not expand, so no tests ran. Tested on Node 20.19. Checks are unchanged.

## 1.0.2 (2026-10-14)
- `stripe-webhook-check` W3 fix text: reprocessing a still-`pending` event is only safe when handlers are idempotent upserts keyed on Stripe ids, or after an atomic lease claim (`locked_until`) so a crashed attempt can be reclaimed; side effects (emails, credit grants) need their own dedupe key. Detection is unchanged.
- Good fixture comment says why its pending retry is safe.

## 1.0.1 (2026-10-14)
- `stripe-webhook-check` W3 is now status-aware. Besides "event.id never recorded", it flags dedupe that skips any already-seen event (e.g. on `23505`) or claim-then-delete with no `pending`/`completed` state, because those lose an event whose first attempt failed or crashed. The fix text describes pending → completed with 5xx on failure. The good fixture now uses that pattern, and there are new tests.

## 1.0.0 (2026-10-14)
- First release: the `rls-check` (R1–R5) and `stripe-webhook-check` (W1–W5) skills, zero-dependency checkers, test fixtures, and CI.
