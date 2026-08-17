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
  scheduledTimeToUtcIso,
} from "@/lib/ordering-hours";
import { DELIVERY_CONFIG } from "@/lib/delivery";
import { getUberQuote } from "@/lib/uber-direct";
import { getProteinSurcharge } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

// Max lengths are deliberate: every string here ends up in email HTML, the
// kitchen slip, and Stripe metadata (500-char cap per value) — unbounded input
// is both an abuse vector and a checkout-breaking one.
const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Valid email is required").max(254),
  phone: z.string().min(7, "Valid phone is required").max(25, "Phone number is too long"),
  items: z.array(
    z.object({
      id: z.string().max(120),
      name: z.string().max(150),
      price: z.number(),
      quantity: z.number().int("Whole numbers only").min(1).max(20, "Maximum 20 per item"),
      protein: z.string().max(60).optional(),
      spicyLevel: z.string().max(60).optional(),
      specialInstructions: z.string().max(200, "Special instructions are too long").optional(),
    })
  ).min(1, "At least one item is required").max(50, "Too many items in cart"),
  promoCodeId: z.string().max(100).optional(),
  scheduledDate: z.string().max(20).optional(),
  scheduledTime: z.string().max(10).optional(),
  tipAmount: z.number().min(0).max(500, "Tip is too large").optional(),
  // DELIVERY — deliveryFee here is only what the customer was SHOWN. The fee
  // actually charged comes from a fresh server-side Uber quote below; trusting
  // this number let anyone edit the request and get free delivery while the
  // restaurant still paid Uber the real fare.
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().max(300).optional(),
  deliveryApt: z.string().max(100).optional(),
  deliveryInstructions: z.string().max(300, "Delivery instructions are too long").optional(),
  deliveryFee: z.number().min(0).max(200).optional(),
});

function getMenuItemPrice(itemId: string): { price: number; category: string } | null {
  const baseId = itemId.split("-").slice(0, 2).join("-");

  for (const category of menuData.categories) {
    const item = (category.items as any[]).find((i: any) => i.id === baseId);
    if (item) return { price: item.price, category: category.name };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = checkoutSchema.parse(body);

    const { name, email, phone, items, promoCodeId, scheduledDate, scheduledTime, tipAmount, isDelivery, deliveryAddress, deliveryApt, deliveryInstructions, deliveryFee } = parsed;

    // --- Handle ordering window vs scheduled time ---
    const hasScheduledDate = typeof scheduledDate === "string" && scheduledDate.trim() !== "";
    const hasScheduledTime = typeof scheduledTime === "string" && scheduledTime.trim() !== "";

    let scheduledForFormatted: string | undefined;
    let scheduledForIso: string | undefined;

    if (hasScheduledDate && hasScheduledTime) {
      if (!isValidScheduledTime(scheduledDate, scheduledTime)) {
        return NextResponse.json(
          { error: "Invalid scheduled time. Please choose a different time slot." },
          { status: 400 }
        );
      }
      scheduledForFormatted = formatScheduledPickup(scheduledDate, scheduledTime);
      // The DB stores machine time (UTC ISO); humans get the formatted string
      // only at display time. Storing the formatted string here is what broke
      // scheduled delivery — new Date("Thursday, June 19 at 4:00 PM") is
      // Invalid Date, so couriers dispatched immediately.
      scheduledForIso = scheduledTimeToUtcIso(scheduledDate, scheduledTime);
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
    // The cart snapshot persisted on the order (and later rendered into the
    // kitchen slip and emails). Client-sent prices are replaced with server
    // prices and unknown fields are dropped — otherwise the slip would print
    // whatever numbers the request body claimed.
    const sanitizedItems: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const menuItem = getMenuItemPrice(item.id);
      if (!menuItem || !menuItem.price) {
        return NextResponse.json({ error: "Invalid item in cart." }, { status: 400 });
      }
      // Protein surcharge, from the same shared table the menu UI displays.
      // Only the Dinner category offers a protein choice.
      const surcharge =
        menuItem.category.toLowerCase() === "dinner"
          ? getProteinSurcharge(item.protein)
          : 0;
      const serverPrice = menuItem.price + surcharge;
      sanitizedItems.push({
        id: item.id,
        name: item.name,
        price: serverPrice,
        quantity: item.quantity,
        protein: item.protein || undefined,
        spicyLevel: item.spicyLevel || undefined,
        specialInstructions: item.specialInstructions || undefined,
      });
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
        : isDelivery ? "Delivery order" : "Pickup order";

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

    // 3. Delivery: enforce requirements and price the fee SERVER-SIDE.
    //    The client's deliveryFee is only the number the customer was shown;
    //    the charge comes from a fresh Uber quote. Minimum order and a real
    //    address are enforced here too — previously both were client-side only.
    let deliveryFeeAmount = 0;
    if (isDelivery) {
      if (!deliveryAddress || deliveryAddress.trim().length < 10) {
        return NextResponse.json(
          { error: "Please enter a full delivery address." },
          { status: 400 }
        );
      }
      if (subtotal < DELIVERY_CONFIG.minOrderAmount) {
        return NextResponse.json(
          { error: `Delivery requires a minimum order of $${DELIVERY_CONFIG.minOrderAmount}.` },
          { status: 400 }
        );
      }

      let serverFee: number;
      try {
        const quote = await getUberQuote(
          DELIVERY_CONFIG.restaurantAddress,
          deliveryAddress.trim(),
          scheduledForIso
        );
        serverFee = quote.fee;
      } catch (err) {
        console.error("[Checkout] Delivery quote failed:", err instanceof Error ? err.message : err);
        return NextResponse.json(
          { error: "We couldn't confirm delivery to this address. Please check the address or choose pickup." },
          { status: 422 }
        );
      }

      // If Uber's price moved past what the customer was shown, make them
      // re-confirm instead of silently charging more.
      const displayedFee = deliveryFee ?? 0;
      if (serverFee > displayedFee + 1) {
        return NextResponse.json(
          {
            error: `The delivery fee for this address is $${serverFee.toFixed(2)}. Please review and try again.`,
            fee: serverFee,
          },
          { status: 409 }
        );
      }
      deliveryFeeAmount = serverFee;
    }

    // 4. Calculate final totals with discount
    const discountedSubtotal = parseFloat((subtotal - discountAmount).toFixed(2));
    const taxRate = parseFloat(process.env.SALES_TAX_RATE || "0.07");
    const tax = parseFloat((discountedSubtotal * taxRate).toFixed(2));
    const tip = parseFloat((tipAmount || 0).toFixed(2));
    const total = parseFloat((discountedSubtotal + tax + tip + deliveryFeeAmount).toFixed(2));

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

    // Add tip as separate Stripe line item
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

    // DELIVERY: Add delivery fee as separate Stripe line item
    if (isDelivery && deliveryFeeAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Delivery Fee",
            description: "Delivery to your address",
          },
          unit_amount: Math.round(deliveryFeeAmount * 100),
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
        tip_amount: tip.toFixed(2),
        is_delivery: isDelivery ? "true" : "false",
        delivery_address: deliveryAddress || "",
        delivery_apt: deliveryApt || "",
        delivery_instructions: deliveryInstructions || "",
        delivery_fee: deliveryFeeAmount.toFixed(2),
        ...(scheduledForFormatted ? { scheduled_for: scheduledForFormatted } : {}),
      },
    });

    // 6. Save order to database. items is the sanitized snapshot (server
    //    prices), scheduledFor is machine time — see notes above.
    await prisma.order.create({
      data: {
        name,
        email,
        phone,
        items: sanitizedItems as any,
        subtotal,
        tax,
        total,
        discountAmount,
        tipAmount: tip,
        stripeSessionId: session.id,
        status: "pending",
        promoCodeId: validPromoCodeId,
        isDelivery: isDelivery || false,
        deliveryAddress: isDelivery ? (deliveryAddress || null) : null,
        deliveryApt: isDelivery ? (deliveryApt || null) : null,
        deliveryInstructions: isDelivery ? (deliveryInstructions || null) : null,
        deliveryFee: deliveryFeeAmount,
        ...(scheduledForIso ? { scheduledFor: scheduledForIso } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Validation problems get a helpful message; everything else gets a generic
    // one. Echoing error.message here leaked Stripe/Prisma internals (and once,
    // schema details) to whoever poked the endpoint.
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid order data." },
        { status: 400 }
      );
    }
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { error: "Checkout failed. Please try again." },
      { status: 500 }
    );
  }
}