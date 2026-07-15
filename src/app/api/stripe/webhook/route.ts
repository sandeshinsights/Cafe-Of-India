import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillOrder } from "@/lib/order-fulfillment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] Missing signature or STRIPE_WEBHOOK_SECRET env var");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[stripe/webhook] checkout.session.completed — session ${session.id}`);

    const result = await fulfillOrder(session.id);

    if (result.success) {
      console.log(`[stripe/webhook] Order ${result.orderId} fulfilled (alreadyFulfilled: ${!!result.alreadyFulfilled})`);
    } else {
      console.error(`[stripe/webhook] Fulfillment failed for ${session.id}:`, result.message);
    }
  }

  // Always return 200 — Stripe retries on non-2xx status
  return NextResponse.json({ received: true });
}