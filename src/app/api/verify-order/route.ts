import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderNotification, sendCustomerConfirmation, sendOrderToPrinter } from "@/lib/email";
import { createUberDelivery, getUberDeliveryStatus } from "@/lib/uber-direct";

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

    // 3. Already verified? Return existing data without re-sending emails
    if (order.status === "paid") {
      let deliveryType: string | undefined;
      let trackingUrl: string | undefined;
      let dropoffEta: string | undefined;
      let uberDeliveryStatus: string | undefined;

      if (order.isDelivery) {
        if (order.uberDeliveryId) {
          deliveryType = "asap";
          // Fetch live status from Uber so tracking URL is fresh on page refresh
          try {
            const uberStatus = await getUberDeliveryStatus(order.uberDeliveryId);
            uberDeliveryStatus = uberStatus.status;
            trackingUrl = uberStatus.trackingUrl;
            dropoffEta = uberStatus.dropoffEta;
          } catch {
            uberDeliveryStatus = order.uberDeliveryStatus || undefined;
          }
        } else if ((order as any).scheduledFor) {
          deliveryType = "scheduled";
        } else {
          deliveryType = "manual_fallback";
        }
      }

      return NextResponse.json({
        success: true,
        orderId: order.id,
        isDelivery: order.isDelivery || undefined,
        deliveryType,
        scheduledFor: (order as any).scheduledFor || undefined,
        uberDeliveryId: order.uberDeliveryId || undefined,
        uberDeliveryStatus,
        trackingUrl,
        dropoffEta,
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

    const scheduledFor = (order as any).scheduledFor || undefined;
    const tipAmount = order.tipAmount || 0;

    // DELIVERY: extract delivery fields from order
    const isDelivery = order.isDelivery || false;
    const deliveryAddress = order.deliveryAddress || null;
    const deliveryApt = order.deliveryApt || null;
    const deliveryInstructions = order.deliveryInstructions || null;
    const deliveryFee = order.deliveryFee || 0;

    // 5. Send restaurant notification email
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
        tipAmount,
        isDelivery,
        deliveryAddress,
        deliveryApt,
        deliveryInstructions,
        deliveryFee,
      });
      console.log("Restaurant email sent successfully");
    } catch (err) {
      console.error("Restaurant email failed:", err);
    }

    // 6. Send customer confirmation email
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
        tipAmount,
        isDelivery,
        deliveryAddress,
        deliveryApt,
        deliveryInstructions,
        deliveryFee,
      });
      console.log("Customer email sent successfully");
    } catch (err) {
      console.error("Customer email failed:", err);
    }

    // 7. Send order to HP ePrint (prints immediately, even for scheduled orders)
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
      isDelivery,
      deliveryAddress,
      deliveryApt,
      deliveryInstructions,
      deliveryFee,
    }).catch((err) => console.error("[Printer] Unhandled error:", err));

    // 8. Handle delivery dispatch
    let uberDeliveryId: string | undefined;
    let uberDeliveryStatus: string | undefined;
    let trackingUrl: string | undefined;
    let dropoffEta: string | undefined;
    let deliveryType: "asap" | "scheduled" | "manual_fallback" = "manual_fallback";
    let scheduledForResponse: string | undefined;

    if (isDelivery && deliveryAddress) {
      const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
      const fifteenMinFromNow = new Date(Date.now() + 15 * 60 * 1000);
      const isScheduled = scheduledDate !== null && scheduledDate > fifteenMinFromNow;

      if (isScheduled) {
        // SCHEDULED — don't dispatch driver now.
        // The Vercel cron job will create the Uber delivery ~30 min before the scheduled time.
        // Order is already printed (step 7) so the kitchen knows about it.
        deliveryType = "scheduled";
        scheduledForResponse = scheduledFor;
        console.log(
          `[Delivery] Order #${order.id} scheduled for ${scheduledFor}. Uber dispatch deferred to cron job.`
        );
      } else {
        // ASAP (or scheduled within 15 min — treat as immediate)
        try {
          const deliveryResult = await createUberDelivery({
            customerName: order.name,
            customerPhone: order.phone,
            deliveryAddress,
            deliveryApt: deliveryApt || undefined,
            deliveryInstructions: deliveryInstructions || undefined,
            orderDescription: `Order ${order.id}`,
          });

          uberDeliveryId = deliveryResult.deliveryId;
          uberDeliveryStatus = deliveryResult.status;
          trackingUrl = deliveryResult.trackingUrl;
          dropoffEta = deliveryResult.dropoffEta;
          deliveryType = "asap";

          // Store on order
          await prisma.order.update({
            where: { id: order.id },
            data: {
              uberDeliveryId: deliveryResult.deliveryId,
              uberDeliveryStatus: deliveryResult.status,
            },
          });

          console.log(`[Delivery] Uber delivery created: ${deliveryResult.deliveryId}`);

          if (!deliveryResult.liveMode) {
            console.log("[Delivery] NOTE: Running in sandbox/test mode — no real driver will be dispatched");
          }
        } catch (err: any) {
          console.error("[Delivery] Uber delivery creation failed:", err.message);
          console.log("[Delivery] Order will require manual delivery");
          deliveryType = "manual_fallback";
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      isDelivery,
      deliveryType: isDelivery ? deliveryType : undefined,
      scheduledFor: scheduledForResponse,
      uberDeliveryId,
      uberDeliveryStatus,
      trackingUrl,
      dropoffEta,
    });
  } catch (error) {
    console.error("Verify order error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}