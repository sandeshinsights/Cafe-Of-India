import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Verify Uber Direct's webhook signature: X-Postmates-Signature is an
 * HMAC-SHA256 hex digest of the raw request body, keyed with the webhook
 * signing secret from the Uber Direct dashboard.
 *
 * If UBER_WEBHOOK_SECRET is not configured we accept the request but log
 * loudly — rejecting would break delivery status updates until the secret is
 * set. Get the signing secret from the Uber Direct dashboard (Webhooks page)
 * and set it in the environment; once set, unsigned requests are refused.
 */
function verifyUberSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.UBER_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[uber/webhook] UBER_WEBHOOK_SECRET not set — accepting unverified webhook. Configure the signing secret from the Uber Direct dashboard."
    );
    return true;
  }
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = Buffer.from(signature.trim().toLowerCase());
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && crypto.timingSafeEqual(provided, wanted);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (!verifyUberSignature(rawBody, request.headers.get("x-postmates-signature"))) {
      console.warn("[uber/webhook] Rejected webhook with missing/invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const deliveryId: string = body.delivery_id;
    const status: string = body.status;

    if (!deliveryId || !status) {
      return NextResponse.json({ received: true });
    }

    console.log(`[uber/webhook] delivery=${deliveryId} status=${status}`);

    const order = await prisma.order.findFirst({
      where: { uberDeliveryId: deliveryId },
    });

    if (!order) {
      console.warn(`[uber/webhook] No order found for delivery ${deliveryId}`);
      return NextResponse.json({ received: true });
    }

    // Map Uber statuses to our coarse delivery state.
    //
    // These are written to `uberStatus`, NEVER to `order.status`. Overwriting
    // `status` used to break the fulfillment idempotency guard (an order in
    // DELIVERED/DELIVERY_FAILED no longer read as "paid", so a success-page
    // refresh or webhook retry re-printed the slip and dispatched a second
    // courier — including for deliveries that had just been cancelled). It also
    // corrupted the `status: "paid"` counts behind the promo "Nth order" gate.
    let newUberStatus: string | null = null;
    switch (status) {
      case "assigned":
        newUberStatus = "DRIVER_ASSIGNED";
        break;
      case "picked_up":
        newUberStatus = "OUT_FOR_DELIVERY";
        break;
      case "delivered":
        newUberStatus = "DELIVERED";
        break;
      case "failed":
      case "cancelled":
        newUberStatus = "DELIVERY_FAILED";
        break;
    }

    const updateData: Record<string, string> = {
      uberDeliveryStatus: status,
    };
    if (newUberStatus) {
      updateData.uberStatus = newUberStatus;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    console.log(`[uber/webhook] Order #${order.id} → ${newUberStatus || "delivery state unchanged"} (uber: ${status})`);

    return NextResponse.json({ received: true, orderId: order.id, uberStatus: newUberStatus });
  } catch (error) {
    console.error("[uber/webhook] Error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}