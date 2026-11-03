# Spec: DEEWALI / DIWALI promo code

Status: **approved and implemented, not deployed**. See `tasks.md` for the decisions taken and results.
Written 2026-11-03 against `main` at `5dd858e`, on branch `feature/diwali-promo`.

## 1. Summary

The site already has a working promo system, and it meets almost all of this
brief. The promo itself is **two new database rows and no new logic**. Code
changes are needed only to close gaps the existing system leaves.

Two things need a decision before anything else (details in section 8):

- **Sales tax does not appear to reach Stripe.** This is an existing problem on
  every order, with or without a code.
- **Test orders on a preview deployment may be real orders.** Previews share the
  production env vars (per `CLAUDE.md`).

## 2. What exists today

### Order flow

| Step | File | Promo-relevant behaviour |
|---|---|---|
| Cart + code entry | `src/components/CartDrawer.tsx` | Step 3 has a code field. Calls `/api/promo/validate`, keeps the result in React state only, and shows a live discount. The email must be filled in first. Sends only `promoCodeId` to checkout. |
| Code validation | `src/app/api/promo/validate/route.ts` | Upper-cases and trims the code. Checks active, expiry, usage caps and Nth-order rule. Returns clear messages, including "This promo code has expired." |
| Order creation + totals | `src/app/api/checkout/route.ts` | Re-checks the code by id and recalculates everything from server prices. Writes `Order` with `promoCodeId` and `discountAmount`. |
| Stripe charge | `src/lib/stripe-line-items.ts`, called from checkout | Removes the discount from food lines before tip and delivery lines are added. Returns the amount actually removed, and that figure is what gets stored. |
| Payment confirmed | `src/app/api/stripe/webhook/route.ts`, `src/app/api/verify-order/route.ts` | Both call `fulfillOrder()`. |
| Usage recording | `src/lib/order-fulfillment.ts:217` | After the claim, increments `usedCount` and writes a `PromoCodeUsage` row, on paid orders only. |
| Emails | `src/lib/email.ts` | The kitchen slip shows the discount. **The restaurant and customer emails do not** (gap G2). |
| Uber Direct | `src/lib/uber-direct.ts` | Sends no money fields. The discount cannot affect a quote or dispatch. |
| Meta Pixel + CAPI, Google | `buildPurchaseSummary()` in `order-fulfillment.ts`, `src/app/order/success/page.tsx`, `src/lib/google-tag.ts` | All use one value (see below). |

### Answers to your questions

- **Existing promo logic?** Yes, full system: `PromoCode` and `PromoCodeUsage`
  tables, a validate route, checkout enforcement, cart UI. This spec extends it.
- **Where totals are calculated:** `src/app/api/checkout/route.ts`.
  - Subtotal: lines 164-220
  - Discount: lines 256-260, finalised at 381-386
  - Delivery fee: lines 320-348, from a fresh Uber quote
  - Tax, tip, total: lines 391-395
  - The cart recalculates the same numbers for display only (`CartDrawer.tsx:205-260`).
- **Tax before or after discount?** After. Tax is calculated on the discounted
  subtotal, but see gap G1.
- **Sessions or PaymentIntents?** Stripe Checkout Sessions with inline
  `price_data`. Our own server logic touches fewer files than Stripe coupons
  (section 3).
- **Purchase value sent to Meta and Google?** Already subtotal minus discount,
  from `buildPurchaseSummary()`, on the Meta server event, Meta browser event and
  Google event. `InitiateCheckout` and `begin_checkout` use the same basis.
  **No change needed.**
- **Restaurant id?** None exists. No `restaurantId` or tenant field anywhere in
  `src` or `prisma`. This is a single-restaurant database, so a row in
  `promo_codes` already belongs to this restaurant.

### Requirements already met without code

Case-insensitive and trimmed; 10% off food only; pickup and delivery; unlimited
uses (null caps); one code per order; no promo minimum (null `min_order_amount`,
which the code never reads anyway); server-side calculation; code and amount saved
on the order.

### Gaps found

- **G1. Sales tax is not charged through Stripe (existing, every order).**
  `tax` is calculated, shown to the customer, stored, and included in
  `Order.total`, but no tax line item is sent to Stripe and the session has no
  `automatic_tax` or `tax_rates`. From the code, Stripe charges food + tip +
  delivery only. **This is from reading the code. Confirm it by comparing one real
  Stripe payment with its `orders.total`.** Not in scope; see Q1.
- **G2. Restaurant and customer emails omit the discount (existing, all promo
  codes).** `order-fulfillment.ts:270` and `:284` don't pass `discountAmount`. The
  email shows the pre-discount subtotal and a discounted total, with nothing
  explaining the difference. See Q2.
- **G3. Checkout silently ignores an expired or inactive code.**
  `checkout/route.ts:232-234`. A customer who applied the code before it expired
  and pays after sees the discount in the cart, then a higher amount on Stripe,
  with no message. This breaks "must be rejected with a clear message". Fixed by
  this spec.

## 3. Proposed design

**A. Add two `promo_codes` rows** through a data-only migration: `DEEWALI` and
`DIWALI`, both 10%, both expiring `2026-11-12T04:59:59Z`. No schema change.

**B. Make checkout reject an expired or inactive code** (G3), before any Stripe
session or order row is created. The cart already displays `error` from this
response, and the customer can remove the code and continue:

```ts
// directly after the promo lookup, checkout/route.ts:230
if (promo?.expiresAt && new Date() > promo.expiresAt) {
  return NextResponse.json(
    { error: "This promo code has expired. Please remove it to continue." },
    { status: 400 }
  );
}
if (promo && !promo.active) {
  return NextResponse.json(
    { error: "This promo code is no longer active. Please remove it to continue." },
    { status: 400 }
  );
}
```

Orders with no code never enter this block, so they are unaffected.

As built, the expired check replaces the old silent branch in place rather than
sitting above it, so no dead code is left. Same behaviour, except a code that is
both inactive and expired reports "no longer active", matching the validate route.

**C. Alias as a second row.** Each row counts separately, so you can also see which
spelling customers use. The reporting query below gives each and you can add them
for a combined figure.

**Counting orders per code** (paid only, because abandoned checkouts also keep a
`promo_code_id`):

```sql
SELECT p.code,
       COUNT(*)                                       AS orders,
       ROUND(SUM(o.discount_amount)::numeric, 2)      AS total_discount,
       ROUND(SUM(o.subtotal - o.discount_amount)::numeric, 2) AS net_food_sales
FROM orders o
JOIN promo_codes p ON p.id = o.promo_code_id
WHERE o.status = 'paid' AND p.code IN ('DEEWALI', 'DIWALI')
GROUP BY p.code;
```

### Alternatives rejected

- **Stripe native coupons / promotion codes.** The code would be entered on
  Stripe's page, so the cart couldn't show the discount. Excluding tip and delivery
  is awkward because our line items use inline prices rather than saved products.
  It also needs Stripe settings changes (rule 6) and would create a second promo
  system alongside the existing one.
- **Hardcoding the code in a new module.** Simple-looking, but it creates a second
  promo system, and switching it off would need a redeploy.
- **New `orders.promo_code` text column.** Duplicates `promo_code_id`, and adds a
  schema migration to the ordering flow for no benefit.
- **Rows only, with no code change.** The smallest option, but it leaves G3, which
  breaks your rejection requirement.

## 4. Files

### Create

| File | Reason |
|---|---|
| `specs/diwali-promo/spec.md` | This document |
| `specs/diwali-promo/tasks.md` | Phase 2 task list |
| `prisma/migrations/20261103120000_add_diwali_promo_codes/migration.sql` | Inserts the two promo rows |
| `scripts/test-diwali-promo.mjs` | Tests, in the project's existing plain-Node style. No new dependency. |

### Modify

| File | Reason |
|---|---|
| `src/app/api/checkout/route.ts` | Reject expired and inactive codes (G3) |

### Modify only if you approve Q2

| File | Reason |
|---|---|
| `src/lib/order-fulfillment.ts` | Pass `discountAmount` to the two emails |
| `src/lib/email.ts` | Show a discount line only when the discount is above 0 |

Not changed: `schema.prisma`, `CartDrawer.tsx`, the validate route, Stripe webhook,
Uber code, tracking code, env vars, `vercel.json`, dependencies.

## 5. Database migration

Rows only, with no table or column changes. `id` and `updated_at` are supplied
because they have no database default.

```sql
-- Data-only: adds the Diwali promo codes. No schema change.
INSERT INTO "public"."promo_codes"
  ("id", "code", "discount_type", "discount_value", "max_uses_per_customer",
   "max_total_uses", "min_order_amount", "order_number", "active", "expires_at",
   "description", "updated_at")
VALUES
  (gen_random_uuid()::text, 'DEEWALI', 'PERCENTAGE', 10, NULL, NULL, NULL, NULL,
   true, '2026-11-12 04:59:59', 'Diwali special: 10% off food', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DIWALI', 'PERCENTAGE', 10, NULL, NULL, NULL, NULL,
   true, '2026-11-12 04:59:59', 'Diwali special: 10% off food', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
```

- `expires_at` has no time zone and Prisma reads it as UTC, so this is 11:59:59 PM
  Boston time on Nov 11 (EST, UTC-5, as daylight saving ended Nov 1).
- **Running this makes the promo live immediately**, because the code that reads
  these rows is already in production. You run it, not me (`npm run db:migrate`).
  Deploy the checkout change first, then migrate. With no schema change, either
  order is safe, but this one means G3 is fixed from the first order.
- I couldn't read the live database (no local `.env`). `ON CONFLICT DO NOTHING`
  would silently keep an existing row with the same code, so check first:
  `SELECT * FROM promo_codes WHERE code IN ('DEEWALI','DIWALI');`

## 6. How totals are calculated

Applied by the server in this order:

1. **Subtotal** = sum of server menu price (including any protein surcharge) x
   quantity. Every menu item counts as food, including drinks.
2. **Discount** = subtotal x 10%, rounded to cents, then removed from Stripe food
   lines. The stored figure is what was actually removed.
3. **Tax** = (subtotal - discount) x `SALES_TAX_RATE` (default 7%).
4. **Tip** = as chosen, never taxed or discounted. Percentage tip buttons are
   based on the discounted subtotal (existing behaviour).
5. **Delivery fee** = fresh Uber quote, not discounted.
6. **Total** = subtotal - discount + tax + tip + delivery.

### Worked example: $40.00 food, $6.00 delivery, $5.00 tip

| Line | With DEEWALI | No code |
|---|---:|---:|
| Subtotal | $40.00 | $40.00 |
| Discount (10%) | -$4.00 | - |
| Discounted subtotal | $36.00 | $40.00 |
| Tax (7%) | $2.52 | $2.80 |
| Tip | $5.00 | $5.00 |
| Delivery | $6.00 | $6.00 |
| **Total shown in cart and stored on order** | **$49.52** | **$53.80** |
| **Stripe charge as the code stands today (G1)** | **$47.00** | **$51.00** |
| Purchase event value (Meta, Google) | $36.00 | $40.00 |

The saved order has `discount_amount = 4.00`, and `promo_code_id` pointing at the
DEEWALI row.

**Rounding:** when the discount lands on a line with quantity above 1, it can
overshoot by up to (quantity - 1) cents. Example: 3 x $13.33 gives $4.00 requested,
$4.02 removed. The cart shows $4.00, while Stripe and the stored order both use
$4.02. It always favours the customer, and it is how the existing helper works.

## 7. Edge cases

| Case | What happens | Source |
|---|---|---|
| Invalid code | "Invalid promo code." No discount. | existing |
| Expired, entered after expiry | "This promo code has expired." | existing |
| Expired, applied before and paid after | Checkout returns the new error. No session or order row is created. | **new** |
| Entered then removed | The X clears it, and checkout receives no code. Identical to a no-code order. | existing |
| Email changed after applying | Code is removed, with "re-apply after changing email". | existing |
| Empty cart | Cart returns early, and the server rejects it too. | existing |
| Cart changed after applying | Discount recalculates in the cart, and the server recalculates independently. | existing |
| Payment fails or is abandoned | Declines are retried on Stripe's page. An abandoned order settles to `abandoned`. No usage is recorded, and the query above excludes it. | existing |
| Page refresh or drawer closed | Cart survives, but the code must be re-entered (it is held in memory only). | existing |
| Tampered request or price | Server uses its own prices and the stored 10%. A browser-sent discount is never read. | existing |
| Checkout before midnight, paid after | Discount honoured. The check runs when the Stripe session is created, and a session can stay open up to 24h. | existing |
| Scheduled for after Nov 11, ordered before | Discount applies, as validity follows the order date (Q4). | existing |
| Delivery minimum ($20) | Still applies. The server tests the pre-discount subtotal, so $21 of food passes. The cart tests the discounted figure, so going back to the delivery step shows a block at $18.90 (Q5). | existing |
| Free-item offer returns before Nov 11 | Offer and code don't stack, and the larger wins. If the offer wins, the order has no `promo_code_id` and is **not counted** for DEEWALI. It's off today, so there's no effect now. | existing |

## 8. Open questions for you

**Q1. Should sales tax be charged through Stripe? (most important)**
Going by the code, the customer is shown $49.52 and charged $47.00 in the example
above, on every order. If that's right, the restaurant is collecting no tax online
while emails say "Total Paid" with tax included. Fixing it would change no-code
Stripe charges, which rule 1 forbids here, so I've left it out. I recommend checking
one real payment today and treating any fix as its own urgent change. **Do you want
that as a separate piece of work?** The promo works either way, but test (a)-(c)
Stripe figures will be the lower number until it's fixed.

**Q2. Add the discount line to the restaurant and customer emails?**
Without it, the worked-example customer email lists $40.00 + $2.52 + $5.00 + $6.00
and then says "Total Paid: $49.52", which doesn't add up. Recommendation: **yes**.
It adds 2 files and no-code emails stay identical, but other promo codes also gain
the line.

**Q3. Should the checkout rejection apply to all codes, or only these two?**
Recommendation: **all codes**. Any other expired code currently charges full price
silently, and special-casing two names adds code that outlives the promotion. It does
change behaviour for orders using an old code, so rule 1 makes this your call.

**Q4. Is tax on the discounted subtotal right?** The code already does this, and
this spec keeps it. A restaurant's own discount normally reduces the taxable amount,
but please confirm with your accountant. Also: should a scheduled order for after
Nov 11 get the discount if placed before? I've assumed yes.

**Q5. Delivery minimum.** "No minimum order" is read as no *promo* minimum, leaving
the $20 delivery minimum in place. Is that right? The cart/server difference in
section 7 is left as is.

**Q6. Where can test orders safely run? (blocks Phase 4)**
Local has no `.env*`, and I won't touch those (rule 6). `CLAUDE.md` says previews
share production env vars, so a preview test order could mean a **real charge, a
real kitchen slip, a real courier and a row in the live database**. Before Phase 4
I need one of:

- **(Recommended)** You provide a local `.env.local` with Stripe test keys, a
  separate test database, and no `HP_EPRINT_EMAIL`, so I can run (a)-(e) locally.
  Uber deliveries need a sandbox or a pickup-only test, and you'd need to tell me
  which applies to your Uber credentials.
- Or you set preview-scoped test values in Vercel first, then use the preview.

Test (e) doesn't need a changed clock: use a test-database row with a past
`expires_at`, which runs the same code path. The automated tests also stub the clock.

## 9. Testing

`scripts/test-diwali-promo.mjs` runs the real route handlers with Prisma, Stripe and
Uber stubbed, using Node's built-in tools. It covers:

- Discount calculation and the worked example
- Expiry at, just before and after the boundary; inactive codes
- Case and whitespace handling; the alias
- Tip and delivery are never discounted
- **No code:** Stripe session parameters and the order row match a snapshot taken from
  `main`
- The migration's values

If stubbing the route handlers turns out to need app code changes, I'll stop and ask
rather than refactor (rule 3).

**Baseline note:** `scripts/test-free-item-offer.mjs` already fails on `main`, because
it tests the offer that was switched off. That will be recorded in the baseline, and
it isn't caused by this work. `npm run build` may also need placeholder values passed
on the command line, since there's no local env file.

## 10. Rollback

**Off in under a minute, no redeploy.** In the Supabase SQL editor:

```sql
UPDATE promo_codes SET active = false, updated_at = NOW()
WHERE code IN ('DEEWALI', 'DIWALI');
```

- New attempts are rejected right away, and with change B so are customers who have
  already applied the code.
- Stripe sessions already open keep their discount until paid or expired (up to 24h).
- Set `active = true` to restore it.
- **Never `DELETE` these rows.** That blanks `promo_code_id` on past orders and deletes
  their usage rows, which would destroy the counts this feature exists for.
- Code rollback, if ever needed: revert the checkout change. No-code orders are
  unaffected either way.
