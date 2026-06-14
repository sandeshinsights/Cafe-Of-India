import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { code, email } = await req.json();

    if (!code || !email) {
      return NextResponse.json(
        { valid: false, message: "Code and email are required." },
        { status: 400 }
      );
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo) {
      return NextResponse.json({ valid: false, message: "Invalid promo code." });
    }

    if (!promo.active) {
      return NextResponse.json({ valid: false, message: "This promo code is no longer active." });
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return NextResponse.json({ valid: false, message: "This promo code has expired." });
    }

    if (promo.maxTotalUses && promo.usedCount >= promo.maxTotalUses) {
      return NextResponse.json({ valid: false, message: "This promo code has reached its usage limit." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check per-customer usage of THIS code
    const customerUsageCount = await prisma.promoCodeUsage.count({
      where: { promoCodeId: promo.id, customerEmail: normalizedEmail },
    });

    if (promo.maxUsesPerCustomer && customerUsageCount >= promo.maxUsesPerCustomer) {
      return NextResponse.json({
        valid: false,
        message: `You've already used this code. It's valid for 1 use only.`,
      });
    }

    // Check order sequence: this code must match the customer's next order number
    if (promo.orderNumber) {
      const totalPaidOrders = await prisma.order.count({
        where: { email: normalizedEmail, status: "paid" },
      });
      const nextOrderNumber = totalPaidOrders + 1;

      if (nextOrderNumber !== promo.orderNumber) {
        return NextResponse.json({
          valid: false,
          message: `This code is for your ${promo.orderNumber}${promo.orderNumber === 1 ? "st" : promo.orderNumber === 2 ? "nd" : promo.orderNumber === 3 ? "rd" : "th"} order. You currently have ${totalPaidOrders} paid order(s).`,
        });
      }
    }

    return NextResponse.json({
      valid: true,
      promoCodeId: promo.id,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      description: promo.description,
      message: `${promo.discountValue}${promo.discountType === "PERCENTAGE" ? "%" : "$"} off!`,
    });
  } catch (error: any) {
    console.error("Promo validate error:", error);
    return NextResponse.json({ valid: false, message: "Something went wrong." }, { status: 500 });
  }
}