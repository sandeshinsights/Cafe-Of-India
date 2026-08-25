/**
 * Tests for applyDiscountToLineItems (src/lib/stripe-line-items.ts).
 *
 * This is the function that decides what Stripe actually charges. If it and the
 * stored order row disagree, the customer is silently over- or undercharged, so
 * every case below asserts BOTH the resulting line items and the reported total.
 *
 *   node --import ./scripts/ts-alias-hooks.mjs scripts/test-discount-spread.mjs
 *
 * Exits non-zero on failure.
 */
import { applyDiscountToLineItems } from "../src/lib/stripe-line-items.ts";

const item = (cents, quantity = 1) => ({
  price_data: {
    currency: "usd",
    product_data: { name: "Item", description: "" },
    unit_amount: cents,
  },
  quantity,
});

const totalOf = (lines) =>
  lines.reduce((sum, l) => sum + l.price_data.unit_amount * l.quantity, 0);

let pass = 0, fail = 0;
function check(label, lines, discountCents, expect) {
  const before = totalOf(lines);
  const applied = applyDiscountToLineItems(lines, discountCents, "Discount");
  const after = totalOf(lines);

  const got = { applied, after, removed: before - after };
  const ok =
    got.applied === expect.applied &&
    got.after === expect.after &&
    // The invariant that matters: what the function reports removing must equal
    // what actually came off the line items, or the order row lies about Stripe.
    got.removed === got.applied;

  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`        expected applied=${expect.applied} after=${expect.after}`);
    console.log(`        got      applied=${got.applied} after=${got.after} actuallyRemoved=${got.removed}`);
    fail++;
  } else pass++;
}

// --- the two bugs this replaced ---
check("discount larger than first line spills to the next (was: silently capped)",
  [item(595), item(3000)], 1398, { applied: 1398, after: 3595 - 1398 });

// 2 x $5.95 = $11.90; taking $5.99 leaves $5.91, which is 295.5c per unit and
// floors to 295, so 600c comes off rather than 599. One cent in the customer's
// favour, reported honestly. The point is that it is ~599 and not 1198: before
// the fix the discount came off the UNIT price and was charged twice over.
check("quantity 2 is not discounted twice (was: 2x the discount)",
  [item(595, 2), item(3000)], 599, { applied: 600, after: 4190 - 600 });

// --- ordinary cases ---
check("discount smaller than first line", [item(3000), item(595)], 599,
  { applied: 599, after: 3595 - 599 });

check("discount equals the whole order", [item(1000), item(500)], 1500,
  { applied: 1500, after: 0 });

check("zero discount changes nothing", [item(1000), item(500)], 0,
  { applied: 0, after: 1500 });

check("discount exactly consumes the first line", [item(599), item(3000)], 599,
  { applied: 599, after: 3000 });

// --- integer rounding: 3 x $3.33 = $9.99, take $5 ---
// (999-500)/3 = 166.33 -> floors to 166, so 3x166=498 remains and 501 comes off.
// Overshooting by a cent is fine; reporting it wrong is not.
check("rounding overshoot is reported honestly", [item(333, 3)], 500,
  { applied: 501, after: 498 });

// --- discount bigger than the whole order: takes what exists, reports truly ---
check("discount exceeding the order stops at zero", [item(500)], 900,
  { applied: 500, after: 0 });

console.log(`\n${pass} passed, ${fail} failed`);
// exitCode rather than exit(): a hard exit() trips a libuv assertion on
// Windows while handles are still closing, printing a scary but meaningless error.
process.exitCode = fail ? 1 : 0;
