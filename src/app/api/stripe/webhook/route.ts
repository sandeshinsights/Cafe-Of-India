import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillOrder } from "@/lib/order-fulfillment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const maxDuration = 60;

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

      // Stripe retries non-2xx responses, and the atomic fulfillment claim makes
      // those retries safe — so hand transient failures back to Stripe instead of
      // swallowing them. A blanket 200 here meant a paid order that failed to
      // fulfill (DB down, schema drift) was dropped with no second attempt.
      // Settled failures ("Payment not completed") stay 200: retrying is pointless.
      if (result.retryable) {
        return NextResponse.json(
          { error: "Fulfillment failed, retry expected", message: result.message },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}