import { NextRequest, NextResponse } from "next/server";
import { getUberQuote } from "@/lib/uber-direct";
import { DELIVERY_CONFIG } from "@/lib/delivery";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || address.trim().length < 10) {
      return NextResponse.json(
        { error: "Please enter a full street address" },
        { status: 400 }
      );
    }

    const quote = await getUberQuote(
      DELIVERY_CONFIG.restaurantAddress,
      address.trim()
    );

    return NextResponse.json({
      fee: quote.fee,
      customerPays: Math.max(0, quote.fee - DELIVERY_CONFIG.subsidyAmount),
      restaurantPays: DELIVERY_CONFIG.subsidyAmount,
      estimatedDurationMinutes: quote.estimatedDurationMinutes,
    });
  } catch (error: any) {
    console.error("[Delivery Quote Error]", error.message);

    const msg = error.message.toLowerCase();
    if (
      msg.includes("out of range") ||
      msg.includes("no couriers") ||
      msg.includes("not servicable") ||
      msg.includes("not serviceable") ||
      msg.includes("unserviceable")
    ) {
      return NextResponse.json(
        {
          error:
            "Sorry, we cannot deliver to this address. Please try a different address or choose pickup.",
          fee: 0,
          customerPays: 0,
          restaurantPays: 0,
        },
        { status: 422 }
      );
    }

    // Fallback to flat fee if Uber API is temporarily down
    console.warn("[Delivery Quote] Uber API error, falling back to flat fee");
    const fallbackFee = DELIVERY_CONFIG.flatFee;
    return NextResponse.json({
      fee: fallbackFee,
      customerPays: Math.max(0, fallbackFee - DELIVERY_CONFIG.subsidyAmount),
      restaurantPays: DELIVERY_CONFIG.subsidyAmount,
      fallback: true,
    });
  }
}