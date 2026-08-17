import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUberDelivery } from "@/lib/uber-direct";
import { sendOrderToPrinter, sendFulfillmentAlert, type StuckOrderReport } from "@/lib/email";
import { isScheduledForLater } from "@/lib/order-fulfillment";

export const maxDuration = 60;

/**
 * Recovery sweep tuning.
 *
 * Fulfillment claims an order (fulfilledAt) *before* doing the work, which makes
 * it at-most-once: if the function dies between the claim and the print/dispatch,
 * nothing retries it. Stripe's retry hits the claim and short-circuits, and the
 * success page returns the already-fulfilled snapshot. This sweep is the only
 * thing that notices, so it has to be conservative about what counts as stuck.
 */
const RECOVERY_LOOKBACK_MS = 24 * 60 * 60 * 1000; // ignore anything older
const RECOVERY_MIN_AGE_MS = 10 * 60 * 1000; // never touch an in-flight fulfillment
const REDISPATCH_MAX_AGE_MS = 2 * 60 * 60 * 1000; // past this, a courier is pointless

const SEND_SPACING_MS = 500; // Resend's default limit is 2 req/s

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Find paid orders whose post-payment work never finished, fix what can be fixed
 * automatically, and email the restaurant about whatever needs a human.
 *
 * Deliberately bounded: only orders fulfilled in the last 24h, only ones idle for
 * at least 10 minutes, and re-dispatch only within 2h of payment. Historical rows
 * are excluded by the migration's printed_at / dispatch_state backfills — without
 * those, every pre-existing order would look un-printed and un-dispatched, and the
 * first run of this sweep would re-print months of orders and send couriers to
 * addresses that were served long ago.
 */
async function recoverStuckOrders(now: Date) {
  const stuck = await prisma.order.findMany({
    where: {
      status: "paid",
      fulfilledAt: {
        gte: new Date(now.getTime() - RECOVERY_LOOKBACK_MS),
        lte: new Date(now.getTime() - RECOVERY_MIN_AGE_MS),
      },
      OR: [
        // Kitchen never got a slip.
        { printedAt: null },
        // Delivery order whose dispatch attempt never concluded (dispatchState
        // null means "no outcome recorded", i.e. the process died mid-attempt).
        // "failed" is excluded: that outcome is settled and already reported.
        { isDelivery: true, uberDeliveryId: null, dispatchState: null },
      ],
    },
    orderBy: { fulfilledAt: "asc" },
  });

  const reports: StuckOrderReport[] = [];
  let reprinted = 0;
  let redispatched = 0;

  for (const order of stuck) {
    const fulfilledAt = order.fulfilledAt;
    const ageMs = fulfilledAt ? now.getTime() - fulfilledAt.getTime() : Infinity;
    const problems: string[] = [];
    const actions: string[] = [];

    // --- Missing kitchen slip: retry the print ---
    if (!order.printedAt) {
      try {
        const printed = await sendOrderToPrinter(
          {
            orderId: order.id, name: order.name, phone: order.phone,
            items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
            discountAmount: order.discountAmount ?? 0,
            scheduledFor: order.scheduledFor || undefined,
            isDelivery: order.isDelivery,
            deliveryAddress: order.deliveryAddress,
            deliveryApt: order.deliveryApt,
            deliveryInstructions: order.deliveryInstructions,
            deliveryFee: order.deliveryFee,
          },
          // A distinct key from the original send: reusing `print-<id>` would let
          // Resend dedupe the retry against the failed original and quietly print
          // nothing at all.
          { idempotencySuffix: "recovery" }
        );

        if (printed) {
          await prisma.order.update({
            where: { id: order.id },
            data: { printedAt: new Date() },
          });
          reprinted++;
          console.log(`[cron/recovery] Re-printed order #${order.id}`);
        } else {
          problems.push("the kitchen slip never printed and printing is not configured");
          actions.push("write this order down manually");
        }
      } catch (err) {
        console.error(`[cron/recovery] Re-print failed for #${order.id}:`, errMessage(err));
        problems.push("the kitchen slip never printed, and printing it again just failed");
        actions.push("write this order down manually");
      }
      await sleep(SEND_SPACING_MS);
    }

    // --- Delivery with no courier and no recorded outcome ---
    if (order.isDelivery && !order.uberDeliveryId && order.dispatchState === null) {
      if (isScheduledForLater(order.scheduledFor)) {
        // Not stuck — just not due yet. Re-dispatching here would send a courier
        // today for tomorrow's order, since this path requests an ASAP delivery.
        // The scheduled-dispatch pass above picks it up when its window arrives.
        console.log(
          `[cron/recovery] Order #${order.id} has no courier yet but is scheduled for ${order.scheduledFor} — leaving it to the scheduled pass`
        );
      } else if (!order.deliveryAddress) {
        await prisma.order.update({
          where: { id: order.id },
          data: { dispatchState: "failed" },
        });
        problems.push("it is a delivery order with no delivery address saved");
        actions.push("call the customer for their address");
      } else if (ageMs <= REDISPATCH_MAX_AGE_MS) {
        try {
          const result = await createUberDelivery({
            customerName: order.name,
            customerPhone: order.phone,
            deliveryAddress: order.deliveryAddress,
            deliveryApt: order.deliveryApt || undefined,
            deliveryInstructions: order.deliveryInstructions || undefined,
            orderDescription: `Order ${order.id}`,
          });

          await prisma.order.update({
            where: { id: order.id },
            data: {
              uberDeliveryId: result.deliveryId,
              uberDeliveryStatus: result.status,
              dispatchState: "dispatched",
            },
          });
          redispatched++;
          console.log(`[cron/recovery] Re-dispatched order #${order.id} → ${result.deliveryId}`);
        } catch (err) {
          console.error(`[cron/recovery] Re-dispatch failed for #${order.id}:`, errMessage(err));
          await prisma.order.update({
            where: { id: order.id },
            data: { dispatchState: "failed" },
          });
          problems.push("no delivery driver was ever assigned, and requesting one again failed");
          actions.push(`deliver to ${order.deliveryAddress} yourselves, or call the customer`);
        }
      } else {
        // Too old for a courier to be useful. Record the settled outcome so the
        // customer's success page stops saying "arranging" and says manual.
        await prisma.order.update({
          where: { id: order.id },
          data: { dispatchState: "failed" },
        });
        problems.push("no delivery driver was ever assigned, and it is now too late to send one");
        actions.push(`deliver to ${order.deliveryAddress} yourselves, or call the customer to sort it out`);
      }
    }

    if (problems.length > 0) {
      reports.push({
        orderId: order.id,
        name: order.name,
        phone: order.phone,
        total: order.total,
        fulfilledAt: order.fulfilledAt,
        problem: problems.join("; and "),
        action: actions.join("; ") + ".",
      });
    }
  }

  if (reports.length > 0) {
    try {
      await sendFulfillmentAlert(reports);
    } catch (err) {
      console.error("[cron/recovery] Alert email failed:", errMessage(err));
    }
  }

  return {
    examined: stuck.length,
    reprinted,
    redispatched,
    needsHuman: reports.length,
  };
}

export async function GET(request: Request) {
  // The unset-secret check matters: without it, a missing CRON_SECRET means the
  // expected header is the literal string "Bearer undefined", which anyone can
  // send — turning a misconfiguration into an open endpoint.
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const nowISO = now.toISOString();
  const windowEndISO = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const pendingOrders = await prisma.order.findMany({
    where: {
      isDelivery: true,
      status: "paid",
      scheduledFor: {
        gte: nowISO,
        lte: windowEndISO,
      },
      uberDeliveryId: null,
    },
  });

  if (pendingOrders.length > 0) {
    console.log(`[cron/dispatch-scheduled] Found ${pendingOrders.length} scheduled order(s) due within 30 min`);
  }

  const results = [];

  for (const order of pendingOrders) {
    if (!order.deliveryAddress) {
      console.warn(`[cron/dispatch-scheduled] Order #${order.id} has no delivery address, skipping`);
      results.push({ orderId: order.id, status: "skipped", reason: "no delivery address" });
      continue;
    }

    try {
      const deliveryResult = await createUberDelivery({
        customerName: order.name,
        customerPhone: order.phone,
        deliveryAddress: order.deliveryAddress,
        deliveryApt: order.deliveryApt || undefined,
        deliveryInstructions: order.deliveryInstructions || undefined,
        orderDescription: `Order ${order.id}`,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          uberDeliveryId: deliveryResult.deliveryId,
          uberDeliveryStatus: deliveryResult.status,
          dispatchState: "dispatched",
        },
      });

      console.log(`[cron/dispatch-scheduled] Dispatched order #${order.id} → ${deliveryResult.deliveryId}`);
      results.push({ orderId: order.id, status: "dispatched", deliveryId: deliveryResult.deliveryId });
    } catch (err: any) {
      console.error(`[cron/dispatch-scheduled] Failed for order #${order.id}:`, err.message);
      results.push({ orderId: order.id, status: "retry_next_cycle" });
    }
  }

  // Second job on the same schedule: catch orders whose post-payment work died
  // half-finished. Runs after the dispatch pass so a scheduled order dispatched
  // above is not also seen as stuck.
  const recovery = await recoverStuckOrders(new Date());
  if (recovery.examined > 0) {
    console.log(`[cron/recovery] ${JSON.stringify(recovery)}`);
  }

  return NextResponse.json({
    checkedAt: nowISO,
    ordersFound: pendingOrders.length,
    results,
    recovery,
  });
}