import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderNotification, sendCustomerConfirmation, sendOrderToPrinter } from "@/lib/email";
import { createUberDelivery, getUberDeliveryStatus } from "@/lib/uber-direct";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
}

export async function fulfillOrder(sessionId: string): Promise<FulfillmentResult> {
  try {
    // 1. Verify with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return { success: false, message: "Payment not completed" };
    }

    // 2. Find the order
    const order = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
    });
    if (!order) {
      return { success: false, message: "Order not found" };
    }

    // 3. Already fulfilled? Return existing data (idempotency guard)
    if (order.status === "paid") {
      let deliveryType: string | undefined;
      let trackingUrl: string | undefined;
      let dropoffEta: string | undefined;
      let uberDeliveryStatus: string | undefined;

      if (order.isDelivery) {
        if (order.uberDeliveryId) {
          deliveryType = "asap";
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

      return {
        success: true,
        orderId: order.id,
        isDelivery: order.isDelivery || undefined,
        deliveryType: deliveryType as FulfillmentResult["deliveryType"],
        scheduledFor: (order as any).scheduledFor || undefined,
        uberDeliveryId: order.uberDeliveryId || undefined,
        uberDeliveryStatus,
        trackingUrl,
        dropoffEta,
        alreadyFulfilled: true,
      };
    }

    // 4. Mark as paid
    await prisma.order.update({
      where: { stripeSessionId: sessionId },
      data: { status: "paid" },
    });

    // 5. Record promo code usage
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
    const scheduledFor = (order as any).scheduledFor || undefined;
    const tipAmount = order.tipAmount || 0;
    const isDelivery = order.isDelivery || false;
    const deliveryAddress = order.deliveryAddress || null;
    const deliveryApt = order.deliveryApt || null;
    const deliveryInstructions = order.deliveryInstructions || null;
    const deliveryFee = order.deliveryFee || 0;

    // 6. Send restaurant notification email
    try {
      await sendOrderNotification({
        orderId: order.id, name: order.name, email: order.email, phone: order.phone,
        items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
        scheduledFor, tipAmount, isDelivery, deliveryAddress, deliveryApt,
        deliveryInstructions, deliveryFee,
      });
      console.log("[Fulfillment] Restaurant email sent");
    } catch (err) {
      console.error("[Fulfillment] Restaurant email failed:", err);
    }

    // 7. Send customer confirmation email
    try {
      await sendCustomerConfirmation({
        orderId: order.id, name: order.name, email: order.email, phone: order.phone,
        items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
        scheduledFor, tipAmount, isDelivery, deliveryAddress, deliveryApt,
        deliveryInstructions, deliveryFee,
      });
      console.log("[Fulfillment] Customer email sent");
    } catch (err) {
      console.error("[Fulfillment] Customer email failed:", err);
    }

    // 8. Print kitchen slip (immediately, even for scheduled orders)
    sendOrderToPrinter({
      orderId: order.id, name: order.name, phone: order.phone,
      items: order.items, subtotal: order.subtotal, tax: order.tax, total: order.total,
      discountAmount: order.discountAmount ?? 0, scheduledFor, isDelivery,
      deliveryAddress, deliveryApt, deliveryInstructions, deliveryFee,
    }).catch((err) => console.error("[Fulfillment] Printer error:", err));

    // 9. Handle delivery dispatch — always dispatch immediately, Uber handles timing
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

      try {
        const result = await createUberDelivery({
          customerName: order.name,
          customerPhone: order.phone,
          deliveryAddress,
          deliveryApt: deliveryApt || undefined,
          deliveryInstructions: deliveryInstructions || undefined,
          orderDescription: `Order ${order.id}`,
          pickupReadyDt: isScheduled ? scheduledDate.toISOString() : undefined,
        });

        uberDeliveryId = result.deliveryId;
        uberDeliveryStatus = result.status;
        trackingUrl = result.trackingUrl;
        dropoffEta = result.dropoffEta;
        deliveryType = isScheduled ? "scheduled" : "asap";
        scheduledForResponse = isScheduled ? scheduledFor : undefined;

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
      }
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
    console.error("[Fulfillment] Error:", error);
    return { success: false, message: "Fulfillment failed" };
  }
}