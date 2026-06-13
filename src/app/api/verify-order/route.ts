import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderNotification, sendCustomerConfirmation } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: "Missing session ID" },
        { status: 400 }
      );
    }

    // 1. Verify with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { success: false, message: "Payment not completed" },
        { status: 400 }
      );
    }

    // 2. Find the order
    const order = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    // 3. Already verified? Return success without re-sending emails
    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        orderId: order.id,
      });
    }

    // 4. Update status to paid
    await prisma.order.update({
      where: { stripeSessionId: sessionId },
      data: { status: "paid" },
    });

    // 5. Send restaurant notification email — AWAIT so Vercel doesn't kill the function
    try {
      await sendOrderNotification({
        orderId: order.id,
        name: order.name,
        email: order.email,
        phone: order.phone,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
      });
      console.log("Restaurant email sent successfully");
    } catch (err) {
      console.error("Restaurant email failed:", err);
    }

    // 6. Send customer confirmation email — AWAIT
    try {
      await sendCustomerConfirmation({
        orderId: order.id,
        name: order.name,
        email: order.email,
        phone: order.phone,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
      });
      console.log("Customer email sent successfully");
    } catch (err) {
      console.error("Customer email failed:", err);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Verify order error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}