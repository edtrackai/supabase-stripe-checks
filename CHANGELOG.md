# Changelog

## 1.0.1 (2026-10-14)
- `stripe-webhook-check` W3 is now status-aware. Besides "event.id never recorded", it flags dedupe that skips any already-seen event (e.g. on `23505`) or claim-then-delete with no `pending`/`completed` state, because those lose an event whose first attempt failed or crashed. The fix text describes pending → completed with 5xx on failure. The good fixture now uses that pattern, and there are new tests.

## 1.0.0 (2026-10-14)
- First release: the `rls-check` (R1–R5) and `stripe-webhook-check` (W1–W5) skills, zero-dependency checkers, test fixtures, and CI.
