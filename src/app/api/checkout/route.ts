import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(7, "Valid phone is required"),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number().min(1),
      protein: z.string().optional(),
      spicyLevel: z.string().optional(),
      specialInstructions: z.string().optional(),
    })
  ).min(1, "At least one item is required"),
});

function isOrderingAvailable(): boolean {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 11:15 AM = 675, 8:45 PM = 1305
  return totalMinutes >= 675 && totalMinutes <= 1305;
}

export async function POST(req: NextRequest) {
  try {
    // Check ordering hours (Eastern Time)
    if (!isOrderingAvailable()) {
      return NextResponse.json(
        { error: "Orders are accepted between 11:15 AM and 8:45 PM." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = checkoutSchema.parse(body);

    const { name, email, phone, items } = parsed;

    // 1. Calculate totals
    let subtotal = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of items) {
      const unitPrice = Math.round(item.price * 100); // cents
      const lineItemTotal = unitPrice * item.quantity;
      subtotal += lineItemTotal / 100;

      // Build description — ALWAYS non-empty
      const descParts: string[] = [];
      if (item.protein && item.protein.trim() !== "") descParts.push(item.protein.trim());
      if (item.spicyLevel && item.spicyLevel.trim() !== "") descParts.push(item.spicyLevel.trim());
      if (item.specialInstructions && item.specialInstructions.trim() !== "") {
        descParts.push(`Note: ${item.specialInstructions.trim()}`);
      }
      // Fallback so description is NEVER empty
      const description = descParts.length > 0
        ? descParts.join(" | ")
        : "Pickup order";

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description,
          },
          unit_amount: unitPrice,
        },
        quantity: item.quantity,
      });
    }

    const taxRate = parseFloat(process.env.SALES_TAX_RATE || "0.07");
    const tax = parseFloat((subtotal * taxRate).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/order/cancelled`,
      metadata: {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
      },
    });

    // 3. Save order to database
    await prisma.order.create({
      data: {
        name,
        email,
        phone,
        items: items as any,
        subtotal,
        tax,
        total,
        stripeSessionId: session.id,
        status: "pending",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed. Please try again." },
      { status: 500 }
    );
  }
}