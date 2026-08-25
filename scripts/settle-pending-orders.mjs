/**
 * One-off backlog settler for `pending` orders.
 *
 * The cron's pre-claim sweep (recoverUnclaimedOrders) deliberately looks back
 * only 24h, so it will never touch the rows that accumulated before it existed.
 * This script does the same job with no age limit, for the historical backlog.
 *
 * It is read-only unless you pass --apply. Run the dry run first: its output is
 * also the answer to "were these abandoned carts, or did we take money and never
 * cook the food?"
 *
 *   node --env-file=.env scripts/settle-pending-orders.mjs
 *   node --env-file=.env scripts/settle-pending-orders.mjs --apply
 *
 * --apply only ever writes `status: "abandoned"`, and only for sessions Stripe
 * reports as expired-and-unpaid. It never fulfills: an order found PAID here is
 * reported loudly and left alone, because fulfilling it means printing a kitchen
 * slip and possibly dispatching a courier, and for a days-old order a human has
 * to decide that. Deploy the cron change and let its sweep handle recent ones.
 */
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const usd = (n) => `$${Number(n).toFixed(2)}`;

const pending = await prisma.order.findMany({
  where: { status: "pending" },
  orderBy: { createdAt: "asc" },
});

console.log(`${pending.length} pending order(s)${apply ? "" : " — DRY RUN, no writes"}\n`);

const paid = [];
let abandoned = 0;
let open = 0;
let errors = 0;

for (const order of pending) {
  const label = `#${order.id.slice(0, 8)} ${order.createdAt.toISOString().slice(0, 16)} ${usd(order.total)} ${order.name}`;

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  } catch (err) {
    console.log(`  ?  ${label} — Stripe lookup failed: ${err.message}`);
    errors++;
    continue;
  }

  if (session.payment_status === "paid") {
    // Money was taken and fulfillment never ran. Nothing printed, no emails.
    console.log(`  !! ${label} — PAID BUT NEVER FULFILLED (${order.email}, ${order.phone})`);
    paid.push(order);
    continue;
  }

  if (session.status === "expired") {
    if (apply) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "abandoned" },
      });
    }
    console.log(`  -  ${label} — abandoned cart${apply ? " → marked abandoned" : ""}`);
    abandoned++;
    continue;
  }

  console.log(`  .  ${label} — session still ${session.status}, leaving alone`);
  open++;
}

console.log(
  `\nabandoned: ${abandoned}   still open: ${open}   lookup errors: ${errors}   PAID-NOT-FULFILLED: ${paid.length}`
);

if (paid.length > 0) {
  console.log(
    "\nThose paid orders took the customer's money and never reached the kitchen.\n" +
      "Decide per order whether to cook and deliver it or refund it — do not bulk-fulfill\n" +
      "days-old orders. Session ids:"
  );
  for (const o of paid) console.log(`  ${o.id}  ${o.stripeSessionId}`);
}

await prisma.$disconnect();
