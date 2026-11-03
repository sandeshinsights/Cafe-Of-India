# Tasks: DEEWALI / DIWALI promo code

Decisions taken from the approved spec, since the open questions were not answered
individually:

- Q1 (tax through Stripe): out of scope, stays a separate piece of work.
- Q2 (email discount line): **approved and included**. `src/lib/email.ts` and
  `src/lib/order-fulfillment.ts` were added to the change.
- Q3 (rejection scope): all codes, as design B in the spec is written.
- Q4, Q5: the spec's assumptions stand.
- Q6 (test environment): unanswered, so Stripe test orders can't run yet.

| # | Task | Files | Check |
|---|---|---|---|
| 1 | Record baseline: typecheck, lint, build, existing tests | none | Results listed under Baseline below |
| 2 | Capture the no-code snapshot from unchanged checkout code | `scripts/test-diwali-promo.mjs` | Script passes before task 4 |
| 3 | Add the data-only migration | `prisma/migrations/20261103120000_add_diwali_promo_codes/migration.sql` | Script checks its values. Not run against any database. |
| 4 | Reject expired and inactive codes at checkout | `src/app/api/checkout/route.ts` | Script's expiry tests fail before, pass after |
| 5 | Complete tests: calculation, expiry, case, alias, tip and delivery untouched, no-code snapshot | `scripts/test-diwali-promo.mjs` | Script exits 0 |
| 6 | Re-run everything and compare with baseline | none | Nothing that passed now fails |
| 7 | Confirm only spec-listed files changed | none | `git status`, `git diff --stat main` |
| 8 | Stripe test orders (a)-(e) | none | **Blocked on Q6** |

## Baseline

Results on the unchanged code, then after the change. Build used placeholder env
vars on the command line only; no env file was created.

| Check | Before | After |
|---|---|---|
| Typecheck (`tsc --noEmit`) | pass | pass |
| Lint | 17 errors, 2 warnings | 17 errors, 2 warnings, same files |
| Build | pass | pass |
| `test-discount-spread` | 8 passed | 8 passed |
| `test-free-item-offer` | 0 passed, 12 failed (offer is switched off) | same |
| `test-diwali-promo` | 58 passed, 7 failed (before the checkout fix) | 71 passed, 0 failed |
| No-discount emails compared with `main` (one-off, 6 variants) | n/a | byte-identical |

## Status

Tasks 1-7 are done. Task 8 and the commit, push and deploy steps are being handled
by the owner. The migration SQL has not been run against any database, and the
cart UI has not been exercised in a browser.
