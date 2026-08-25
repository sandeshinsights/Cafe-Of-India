import type Stripe from "stripe";

/**
 * Take `discountCents` off the food line items and report what was actually
 * taken off.
 *
 * The old version subtracted the whole discount from the first line item's
 * `unit_amount` and floored it at 1 cent, which was wrong twice over:
 *
 *   - `unit_amount` is the price of ONE unit, so a first line with quantity 2
 *     had the discount applied twice and the customer was undercharged.
 *   - When the discount was bigger than that one item, the floor silently
 *     swallowed the rest — the order row said $13.98 off, Stripe charged $5.99
 *     off, and the customer paid the difference.
 *
 * A $13.98 free-item discount lands on a cheap first line (naan, samosa, soup)
 * often enough that both were going to happen regularly.
 *
 * Spreads across line items in order, never taking more from a line than that
 * line is worth. Because unit prices are integers, flooring can overshoot by up
 * to (quantity - 1) cents on a line; the return value is the true total removed,
 * and the caller uses it for tax, the order total, and the stored row — so the
 * database and Stripe always agree, even when they disagree with the requested
 * discount by a cent.
 */
export function applyDiscountToLineItems(
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  discountCents: number,
  label: string
): number {
  let remaining = discountCents;
  let applied = 0;

  for (const lineItem of lineItems) {
    if (remaining <= 0) break;

    const priceData = lineItem.price_data;
    const unitAmount = priceData?.unit_amount;
    if (!priceData || typeof unitAmount !== "number" || unitAmount <= 0) continue;

    const quantity = typeof lineItem.quantity === "number" ? lineItem.quantity : 1;
    const lineTotal = unitAmount * quantity;

    const take = Math.min(remaining, lineTotal);
    const newUnitAmount = Math.floor((lineTotal - take) / quantity);
    const removedHere = lineTotal - newUnitAmount * quantity;

    priceData.unit_amount = newUnitAmount;
    applied += removedHere;
    remaining -= removedHere;

    const currentDesc = priceData.product_data?.description || "";
    priceData.product_data!.description =
      `${currentDesc} | ${label}: -$${(removedHere / 100).toFixed(2)}`.trim();
  }

  return applied;
}
