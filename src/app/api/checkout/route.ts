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
  promoCodeId: z.string().optional(),
});

function isOrderingAvailable(): boolean {
  const now = new Date();
  const etTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 11:15 AM = 675, 8:45 PM = 1245
  return totalMinutes >= 675 && totalMinutes <= 1245;
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

    const { name, email, phone, items, promoCodeId } = parsed;

    // 1. Calculate totals
    let subtotal = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of items) {
      const unitPrice = Math.round(item.price * 100); // cents
      const lineItemTotal = unitPrice * item.quantity;
      subtotal += lineItemTotal / 100;

      const descParts: string[] = [];
      if (item.protein && item.protein.trim() !== "") descParts.push(item.protein.trim());
      if (item.spicyLevel && item.spicyLevel.trim() !== "") descParts.push(item.spicyLevel.trim());
      if (item.specialInstructions && item.specialInstructions.trim() !== "") {
        descParts.push(`Note: ${item.specialInstructions.trim()}`);
      }
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

    // 2. Validate promo code (server-side)
    let discountAmount = 0;
    let validPromoCodeId: string | null = null;
    let promoDescription: string | null = null;

    if (promoCodeId) {
      const promo = await prisma.promoCode.findUnique({
        where: { id: promoCodeId },
      });

      if (promo && promo.active) {
        if (promo.expiresAt && new Date() > promo.expiresAt) {
          // silently ignore expired
        } else if (promo.maxTotalUses && promo.usedCount >= promo.maxTotalUses) {
          // silently ignore max reached
        } else {
          const normalizedEmail = email.toLowerCase().trim();

          const customerUsageCount = await prisma.promoCodeUsage.count({
            where: { promoCodeId: promo.id, customerEmail: normalizedEmail },
          });

          if (!promo.maxUsesPerCustomer || customerUsageCount < promo.maxUsesPerCustomer) {
            // Check order sequence
            let sequenceValid = true;
            if (promo.orderNumber) {
              const totalPaidOrders = await prisma.order.count({
                where: { email: normalizedEmail, status: "paid" },
              });
              if (totalPaidOrders + 1 !== promo.orderNumber) {
                sequenceValid = false;
              }
            }

            if (sequenceValid) {
              if (promo.discountType === "PERCENTAGE") {
                discountAmount = parseFloat((subtotal * promo.discountValue / 100).toFixed(2));
              } else {
                discountAmount = Math.min(promo.discountValue, subtotal);
              }
              validPromoCodeId = promo.id;
              promoDescription = promo.description;
            }
          }
        }
      }
    }

    // 3. Calculate final totals with discount
    const discountedSubtotal = parseFloat((subtotal - discountAmount).toFixed(2));
    const taxRate = parseFloat(process.env.SALES_TAX_RATE || "0.07");
    const tax = parseFloat((discountedSubtotal * taxRate).toFixed(2));
    const total = parseFloat((discountedSubtotal + tax).toFixed(2));

      // 4. Apply discount by reducing the first line item's price
    if (discountAmount > 0) {
      const discountCents = Math.round(discountAmount * 100);
      const firstItem = lineItems[0];
      if (firstItem && firstItem.price_data) {
        const currentAmount = firstItem.price_data.unit_amount;
        const newAmount = Math.max(1, currentAmount - discountCents);
        firstItem.price_data.unit_amount = newAmount;
        // Append discount info to item description
        firstItem.price_data.product_data.description =
          `${firstItem.price_data.product_data.description || ""} | Promo: -$${discountAmount.toFixed(2)}`.trim();
      }
    }

    // 5. Create Stripe Checkout Session
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
        promo_code_id: validPromoCodeId || "",
        discount_amount: discountAmount.toFixed(2),
      },
    });

    // 6. Save order to database
    const order = await prisma.order.create({
      data: {
        name,
        email,
        phone,
        items: items as any,
        subtotal,
        tax,
        total,
        discountAmount,
        stripeSessionId: session.id,
        status: "pending",
        promoCodeId: validPromoCodeId,
      },
    });

    // 7. Record promo usage
    if (validPromoCodeId && discountAmount > 0) {
      await prisma.$transaction([
        prisma.promoCode.update({
          where: { id: validPromoCodeId },
          data: { usedCount: { increment: 1 } },
        }),
        prisma.promoCodeUsage.create({
          data: {
            promoCodeId: validPromoCodeId,
            orderId: order.id,
            customerEmail: email.toLowerCase().trim(),
            discountAmount,
          },
        }),
      ]);
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed. Please try again." },
      { status: 500 }
    );
  }
}