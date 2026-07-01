import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import menuData from "@/data/menu.json";
import {
  isOrderingWindowOpen,
  getOrderingClosedReason,
  isValidScheduledTime,
  formatScheduledPickup,
} from "@/lib/ordering-hours";

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
      quantity: z.number().min(1).max(20, "Maximum 20 per item"),
      protein: z.string().optional(),
      spicyLevel: z.string().optional(),
      specialInstructions: z.string().optional(),
    })
  ).min(1, "At least one item is required"),
  promoCodeId: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  tipAmount: z.number().min(0).optional(), // TIP: accept tip from cart
});

function getMenuItemPrice(itemId: string): number | null {
  const baseId = itemId.split("-").slice(0, 2).join("-");

  for (const category of menuData.categories) {
    const item = (category.items as any[]).find((i: any) => i.id === baseId);
    if (item) return item.price;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkoutSchema.parse(body);

    const { name, email, phone, items, promoCodeId, scheduledDate, scheduledTime, tipAmount } = parsed; // TIP: destructure tipAmount

    // --- Handle ordering window vs scheduled time ---
    const hasScheduledDate = typeof scheduledDate === "string" && scheduledDate.trim() !== "";
    const hasScheduledTime = typeof scheduledTime === "string" && scheduledTime.trim() !== "";

    let scheduledForFormatted: string | undefined;

    if (hasScheduledDate && hasScheduledTime) {
      if (!isValidScheduledTime(scheduledDate, scheduledTime)) {
        return NextResponse.json(
          { error: "Invalid scheduled time. Please choose a different time slot." },
          { status: 400 }
        );
      }
      scheduledForFormatted = formatScheduledPickup(scheduledDate, scheduledTime);
    } else {
      if (!isOrderingWindowOpen()) {
        return NextResponse.json(
          { error: getOrderingClosedReason() || "Orders are not available at this time." },
          { status: 403 }
        );
      }
    }

    // 1. Calculate totals using SERVER prices (ignore client-sent prices)
    let subtotal = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of items) {
      const serverPrice = getMenuItemPrice(item.id);
      if (!serverPrice) {
        return NextResponse.json({ error: "Invalid item in cart." }, { status: 400 });
      }
      const unitPrice = Math.round(serverPrice * 100); // cents
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
    const tip = parseFloat((tipAmount || 0).toFixed(2)); // TIP: get tip value
    const total = parseFloat((discountedSubtotal + tax + tip).toFixed(2)); // TIP: include tip in total

    // 4. Apply discount by reducing the first line item's price
    if (discountAmount > 0) {
      const discountCents = Math.round(discountAmount * 100);
      const firstItem = lineItems[0];
      if (firstItem?.price_data?.unit_amount) {
        const currentAmount = firstItem.price_data.unit_amount;
        const newAmount = Math.max(1, currentAmount - discountCents);
        firstItem.price_data.unit_amount = newAmount;
        const currentDesc = firstItem.price_data.product_data?.description || "";
        firstItem.price_data.product_data!.description = `${currentDesc} | Promo: -$${discountAmount.toFixed(2)}`.trim();
      }
    }

    // TIP: Add tip as separate Stripe line item
    if (tip > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tip / Gratuity",
            description: "Thank you for your generosity!",
          },
          unit_amount: Math.round(tip * 100),
        },
        quantity: 1,
      });
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
        tip_amount: tip.toFixed(2), // TIP: pass tip in metadata
        ...(scheduledForFormatted ? { scheduled_for: scheduledForFormatted } : {}),
      },
    });

    // 6. Save order to database
    await prisma.order.create({
      data: {
        name,
        email,
        phone,
        items: items as any,
        subtotal,
        tax,
        total,
        discountAmount,
        tipAmount: tip, // TIP: store tip in DB
        stripeSessionId: session.id,
        status: "pending",
        promoCodeId: validPromoCodeId,
        ...(scheduledForFormatted ? { scheduledFor: scheduledForFormatted } : {}),
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