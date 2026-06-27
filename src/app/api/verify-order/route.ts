import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderNotification, sendCustomerConfirmation, sendOrderToPrinter } from "@/lib/email";

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

    // 4.5 Record promo code usage (only when payment succeeds)
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

    // Get scheduled info from order (undefined for regular immediate orders)
    const scheduledFor = (order as any).scheduledFor || undefined;

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
        scheduledFor,
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
        scheduledFor,
      });
      console.log("Customer email sent successfully");
    } catch (err) {
      console.error("Customer email failed:", err);
    }

    // 7. Send order to HP ePrint for auto-printing (non-blocking, won't affect existing flow)
    sendOrderToPrinter({
      orderId: order.id,
      name: order.name,
      phone: order.phone,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      discountAmount: order.discountAmount ?? 0,
      scheduledFor,
    }).catch((err) => console.error("[Printer] Unhandled error:", err));

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