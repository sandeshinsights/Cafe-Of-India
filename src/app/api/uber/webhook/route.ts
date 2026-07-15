import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    // Map Uber statuses to our order statuses
    let newOrderStatus: string | null = null;
    switch (status) {
      case "assigned":
        newOrderStatus = "DRIVER_ASSIGNED";
        break;
      case "picked_up":
        newOrderStatus = "OUT_FOR_DELIVERY";
        break;
      case "delivered":
        newOrderStatus = "DELIVERED";
        break;
      case "failed":
      case "cancelled":
        newOrderStatus = "DELIVERY_FAILED";
        break;
    }

    const updateData: Record<string, string> = {
      uberDeliveryStatus: status,
    };
    if (newOrderStatus) {
      updateData.status = newOrderStatus;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    console.log(`[uber/webhook] Order #${order.id} → ${newOrderStatus || "status unchanged"} (uber: ${status})`);

    return NextResponse.json({ received: true, orderId: order.id, orderStatus: newOrderStatus });
  } catch (error) {
    console.error("[uber/webhook] Error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}