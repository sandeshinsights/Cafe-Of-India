import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUberDelivery } from "@/lib/uber-direct";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  if (pendingOrders.length === 0) {
    return NextResponse.json({ checkedAt: nowISO, dispatched: 0 });
  }

  console.log(`[cron/dispatch-scheduled] Found ${pendingOrders.length} scheduled order(s) due within 30 min`);

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
        },
      });

      console.log(`[cron/dispatch-scheduled] Dispatched order #${order.id} → ${deliveryResult.deliveryId}`);
      results.push({ orderId: order.id, status: "dispatched", deliveryId: deliveryResult.deliveryId });
    } catch (err: any) {
      console.error(`[cron/dispatch-scheduled] Failed for order #${order.id}:`, err.message);
      results.push({ orderId: order.id, status: "retry_next_cycle" });
    }
  }

  return NextResponse.json({
    checkedAt: nowISO,
    ordersFound: pendingOrders.length,
    results,
  });
}