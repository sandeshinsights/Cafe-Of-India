import { NextRequest, NextResponse } from "next/server";
import { getUberQuote } from "@/lib/uber-direct";

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
      "155 Main Street, Maynard, MA 01754",
      address.trim()
    );

    return NextResponse.json({
      fee: quote.fee,
      customerPays: quote.fee,
      restaurantPays: 0,
      estimatedDurationMinutes: quote.estimatedDurationMinutes,
    });
  } catch (error: any) {
    console.error("[Delivery Quote Error]", error.message);

    // ALL Uber errors block delivery — never silently fall back to flat fee
    return NextResponse.json(
      {
        error:
          "Sorry, this address is outside our delivery area. We currently deliver within ~10 miles of Cafe of India (155 Main St, Maynard, MA). Please try a different address or choose pickup.",
        fee: 0,
        customerPays: 0,
        restaurantPays: 0,
      },
      { status: 422 }
    );
  }
}