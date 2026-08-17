import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderNotification, sendCustomerConfirmation, sendOrderToPrinter } from "@/lib/email";
import { createUberDelivery, getUberDeliveryStatus } from "@/lib/uber-direct";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Resend's default rate limit is 2 requests/second. Fulfillment fires three
 * sends back-to-back, so they are spaced out rather than burst — a 429 used to
 * come back as a silently-swallowed failure (usually the kitchen slip).
 */
const SEND_SPACING_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FulfillmentResult {
  success: boolean;
  orderId?: string;
  isDelivery?: boolean;
  deliveryType?: "asap" | "scheduled" | "manual_fallback";
  scheduledFor?: string;
  uberDeliveryId?: string;
  uberDeliveryStatus?: string;
  trackingUrl?: string;
  dropoffEta?: string;
  message?: string;
  alreadyFulfilled?: boolean;
  /**
   * True when this is a delivery order whose courier dispatch has not concluded
   * yet — another caller holds the claim and is still working. The caller should
   * poll rather than draw a conclusion; in particular it must NOT be shown as a
   * manual delivery, which is what the old "no uberDeliveryId ⇒ manual_fallback"
   * inference did to customers whose courier was seconds away.
   */
  dispatchPending?: boolean;
  /**
   * True when the failure looks transient (Stripe/DB/network) rather than a
   * settled "no". The Stripe webhook returns a non-2xx for these so Stripe
   * retries; the atomic claim makes those retries safe.
   */
  retryable?: boolean;
}

type OrderRow = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;

/** Dispatch outcome persisted on the order — see `dispatchState` in schema.prisma. */
type DispatchState = "dispatched" | "failed";

/**
 * A scheduled order is one whose pickup is far enough out that the courier is
 * not coming now. Uber owns the timing (we pass pickup_ready_dt), but the
 * customer-facing message differs, so both fulfillment and the already-fulfilled
 * snapshot have to draw the line in the same place.
 */
const SCHEDULED_THRESHOLD_MS = 15 * 60 * 1000;

export function isScheduledForLater(scheduledFor: string | null | undefined): boolean {
  if (!scheduledFor) return false;
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS;
}

/**
 * Shape the response for an order that some other path has already fulfilled.
 * Pulls live Uber status so a success-page refresh still shows fresh tracking.
 */
async function describeFulfilledOrder(order: OrderRow): Promise<FulfillmentResult> {
  let deliveryType: FulfillmentResult["deliveryType"];
  let trackingUrl: string | undefined;
  let dropoffEta: string | undefined;
  let uberDeliveryStatus: string | undefined;
  let dispatchPending: boolean | undefined;

  const scheduledLater = isScheduledForLater(order.scheduledFor);

  if (order.isDelivery) {
    if (order.uberDeliveryId) {
      // A dispatched order still reads as "scheduled" until its pickup window is
      // close, so a customer who ordered for tomorrow is not told a driver is
      // already on the way.
      deliveryType = scheduledLater ? "scheduled" : "asap";
      try {
        const uberStatus = await getUberDeliveryStatus(order.uberDeliveryId);
        uberDeliveryStatus = uberStatus.status;
        trackingUrl = uberStatus.trackingUrl;
        dropoffEta = uberStatus.dropoffEta;
      } catch {
        uberDeliveryStatus = order.uberDeliveryStatus || undefined;
      }
    } else if (scheduledLater) {
      deliveryType = "scheduled";
    } else if (order.dispatchState === "failed") {
      deliveryType = "manual_fallback";
    } else {
      // dispatchState is still null: the claim winner has not finished its
      // dispatch attempt. Report nothing rather than guessing wrong.
      dispatchPending = true;
    }
  }

  return {
    success: true,
    orderId: order.id,
    isDelivery: order.isDelivery || undefined,
    deliveryType,
    scheduledFor: order.scheduledFor || undefined,
    uberDeliveryId: order.uberDeliveryId || undefined,
    uberDeliveryStatus,
    trackingUrl,
    dropoffEta,
    dispatchPending,
    alreadyFulfilled: true,
  };
}

/**
 * Fulfill a paid Stripe checkout session: emails, kitchen slip, Uber dispatch.
 *
 * Safe to call concurrently and repeatedly. Exactly one caller wins the atomic
 * `fulfilledAt` claim; everyone else gets the already-fulfilled snapshot. The
 * claim deliberately does NOT key off `status` — the Uber webhook used to
 * overwrite that column, which silently disarmed the old guard and let refreshes
 * and webhook retries re-print orders and dispatch second couriers.
 */
export async function fulfillOrder(sessionId: string): Promise<FulfillmentResult> {
  try {
    // 1. Verify with Stripe — nothing happens until payment is confirmed
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return { success: false, message: "Payment not completed" };
    }

    // 2. Find the order. Retryable: the webhook can outrun the checkout route's
    //    own write, and a retry a few seconds later will find the row.
    const order = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
    });
    if (!order) {
      return { success: false, message: "Order not found", retryable: true };
    }

    // 3. Atomically claim fulfillment. Only the caller that flips fulfilledAt
    //    from null proceeds; a concurrent webhook + success-page pair can no
    //    longer both pass this point.
    const claim = await prisma.order.updateMany({
      where: { id: order.id, fulfilledAt: null },
      data: { fulfilledAt: new Date(), status: "paid" },
    });

    if (claim.count !== 1) {
      const current = await prisma.order.findUnique({ where: { id: order.id } });
      console.log(`[Fulfillment] Order ${order.id} already fulfilled — skipping`);
      return current
        ? await describeFulfilledOrder(current)
        : { success: false, message: "Order not found", retryable: true };
    }

    console.log(`[Fulfillment] Claimed order ${order.id}`);

    // 4. Record promo code usage (claim winner only, so it can't double-count)
    if (order.promoCodeId && order.discountAmount > 0) {
      await prisma.$transaction([
        prisma.promoCode.update({
          where: { id: order.promoCodeId },
          data: { usedCount: { increment: 1 } },
        }),
        prisma.promoCodeUsage.create({
          data: {
            promoCodeId: order.promoCodeId,
            orderId: order.id,
            customerEmail: order.email.toLowerCase().trim(),
            discountAmount: order.discountAmount,
          },
        }),
      ]);
    }

    // Extract fields
    const scheduledFor = order.scheduledFor || undefined;
    const tipAmount = order.tipAmount || 0;
    const isDelivery = order.isDelivery || false;
    const deliveryAddress = order.deliveryAddress || null;
    const deliveryApt = order.deliveryApt || null;
    const deliveryInstructions = order.deliveryInstructions || null;
    const deliveryFee = order.deliveryFee || 0;

    // 5. Kitchen slip FIRST and awaited. It is the most operationally critical
    //    send, and it used to go last in an un-awaited burst — the send most
    //    likely to be rate-limited and the one whose failure was invisible.
    try {
      const printed = await sendOrderToPrinter({
        orderId: order.id, name: order.name, phone: order.phone,
        items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
        discountAmount: order.discountAmount ?? 0, scheduledFor, isDelivery,
        deliveryAddress, deliveryApt, deliveryInstructions, deliveryFee,
      });

      if (printed) {
        await prisma.order.update({
          where: { id: order.id },
          data: { printedAt: new Date() },
        });
      }
    } catch (err) {
      // printedAt stays null — the order is findable for a manual reprint
      console.error(`[Fulfillment] PRINT FAILED for order ${order.id}:`, err);
    }

    await sleep(SEND_SPACING_MS);

    // 6. Send restaurant notification email
    try {
      await sendOrderNotification({
        orderId: order.id, name: order.name, email: order.email, phone: order.phone,
        items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
        scheduledFor, tipAmount, isDelivery, deliveryAddress, deliveryApt,
        deliveryInstructions, deliveryFee,
      });
    } catch (err) {
      console.error(`[Fulfillment] RESTAURANT EMAIL FAILED for order ${order.id}:`, err);
    }

    await sleep(SEND_SPACING_MS);

    // 7. Send customer confirmation email
    try {
      await sendCustomerConfirmation({
        orderId: order.id, name: order.name, email: order.email, phone: order.phone,
        items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
        scheduledFor, tipAmount, isDelivery, deliveryAddress, deliveryApt,
        deliveryInstructions, deliveryFee,
      });
    } catch (err) {
      console.error(`[Fulfillment] CUSTOMER EMAIL FAILED for order ${order.id}:`, err);
    }

    // 8. Handle delivery dispatch — always dispatch immediately, Uber handles timing
    let uberDeliveryId: string | undefined;
    let uberDeliveryStatus: string | undefined;
    let trackingUrl: string | undefined;
    let dropoffEta: string | undefined;
    let deliveryType: "asap" | "scheduled" | "manual_fallback" = "manual_fallback";
    let scheduledForResponse: string | undefined;

    if (isDelivery && deliveryAddress) {
      // Re-read: never dispatch a second courier for an order that already has
      // one, whatever else has happened to this row in the meantime.
      const current = await prisma.order.findUnique({
        where: { id: order.id },
        select: { uberDeliveryId: true, uberDeliveryStatus: true },
      });

      const isScheduled = isScheduledForLater(scheduledFor);
      let dispatchState: DispatchState;

      if (current?.uberDeliveryId) {
        console.log(
          `[Fulfillment] Order ${order.id} already has Uber delivery ${current.uberDeliveryId} — not dispatching again`
        );
        uberDeliveryId = current.uberDeliveryId;
        uberDeliveryStatus = current.uberDeliveryStatus || undefined;
        deliveryType = isScheduled ? "scheduled" : "asap";
        dispatchState = "dispatched";
      } else {
        try {
          const result = await createUberDelivery({
            customerName: order.name,
            customerPhone: order.phone,
            deliveryAddress,
            deliveryApt: deliveryApt || undefined,
            deliveryInstructions: deliveryInstructions || undefined,
            orderDescription: `Order ${order.id}`,
            pickupReadyDt: isScheduled ? new Date(scheduledFor!).toISOString() : undefined,
          });

          uberDeliveryId = result.deliveryId;
          uberDeliveryStatus = result.status;
          trackingUrl = result.trackingUrl;
          dropoffEta = result.dropoffEta;
          deliveryType = isScheduled ? "scheduled" : "asap";
          scheduledForResponse = isScheduled ? scheduledFor : undefined;
          dispatchState = "dispatched";

          await prisma.order.update({
            where: { id: order.id },
            data: { uberDeliveryId: result.deliveryId, uberDeliveryStatus: result.status },
          });

          if (isScheduled) {
            console.log(`[Fulfillment] Uber delivery scheduled: ${result.deliveryId} for ${scheduledFor}`);
          } else {
            console.log(`[Fulfillment] Uber delivery created: ${result.deliveryId}`);
          }
        } catch (err: any) {
          console.error("[Fulfillment] Uber delivery creation failed:", err.message);
          deliveryType = "manual_fallback";
          dispatchState = "failed";
        }
      }

      // Record the outcome either way. Until this lands, dispatchState is null,
      // which is how a concurrent success-page load knows dispatch is still in
      // flight instead of announcing a manual delivery. If the function dies
      // before this write, the recovery sweep in /api/cron/dispatch-scheduled
      // picks the order up.
      await prisma.order.update({
        where: { id: order.id },
        data: { dispatchState },
      });
    }

    return {
      success: true,
      orderId: order.id,
      isDelivery,
      deliveryType: isDelivery ? deliveryType : undefined,
      scheduledFor: scheduledForResponse,
      uberDeliveryId,
      uberDeliveryStatus,
      trackingUrl,
      dropoffEta,
    };
  } catch (error) {
    // Anything landing here is infrastructure (Stripe unreachable, DB down, a
    // schema drift) rather than a decision about the order, so it is worth
    // retrying. Note this only recovers failures *before* the claim lands —
    // once claimed, recovery is the cron sweep's job, not Stripe's.
    console.error("[Fulfillment] Error:", error);
    return { success: false, message: "Fulfillment failed", retryable: true };
  }
}
