import { NextRequest, NextResponse } from "next/server";
import { createUberDelivery, getUberDeliveryStatus } from "@/lib/uber-direct";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryApt,
      deliveryInstructions,
    } = body;

    if (!orderId || !customerName || !customerPhone || !deliveryAddress) {
      return NextResponse.json(
        { error: "Missing required delivery fields" },
        { status: 400 }
      );
    }

    const result = await createUberDelivery({
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryApt,
      deliveryInstructions,
      orderDescription: `Order ${orderId}`,
    });

    return NextResponse.json({
      success: true,
      deliveryId: result.deliveryId,
      trackingUrl: result.trackingUrl,
    });
  } catch (error: any) {
    console.error("[Delivery Create Error]", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliveryId = searchParams.get("id");

    if (!deliveryId) {
      return NextResponse.json(
        { error: "Missing delivery ID" },
        { status: 400 }
      );
    }

    const status = await getUberDeliveryStatus(deliveryId);
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("[Delivery Status Error]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}