import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendCateringNotification } from "@/lib/email";
import {
  queueMetaCapiEvent,
  getClientIp,
  getClientUserAgent,
} from "@/lib/meta-capi";

/**
 * Zod Schema — validates catering form input
 */
const cateringSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(7, "Please enter a valid phone number")
    .max(20, "Phone number is too long"),
  eventType: z.string().min(1, "Please select an event type"),
  guestCount: z
    .number()
    .int("Guest count must be a whole number")
    .min(10, "Minimum 10 guests")
    .max(500, "Maximum 500 guests"),
  eventDate: z.string().min(1, "Please select an event date"),
  message: z.string().max(1000, "Message is too long").optional(),
  // Meta Pixel handoff — optional, never load-bearing. A missing block just
  // means a lower-quality Lead event, never a rejected inquiry.
  meta: z
    .object({
      eventId: z.string().max(100).optional(),
      fbp: z.string().max(200).optional(),
      fbc: z.string().max(400).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse the request body
    const body = await request.json();

    // 2. Validate with Zod
    const result = cateringSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { success: false, message: firstError.message },
        { status: 400 }
      );
    }

    // `meta` is stripped out here so it never reaches Prisma or the email
    // template — it is transport for the conversion event, not inquiry content.
    const { meta, ...data } = result.data;

    // 3. Insert into database via Prisma
    await prisma.cateringInquiry.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        eventType: data.eventType,
        guestCount: data.guestCount,
        eventDate: new Date(data.eventDate),
        message: data.message || null,
      },
    });

    // 4. Send email notification (await, not fire-and-forget)
try {
  await sendCateringNotification(data);
} catch (err) {
  console.error("Catering email failed:", err);
}

    // 5. Meta Lead (server copy). Deferred past the response by
    //    queueMetaCapiEvent and error-swallowing by design — a Meta problem must
    //    not turn a saved inquiry into a failure the customer sees.
    if (meta?.eventId) {
      queueMetaCapiEvent({
        eventName: "Lead",
        eventId: meta.eventId,
        eventSourceUrl:
          request.headers.get("referer") || process.env.NEXT_PUBLIC_BASE_URL,
        userData: {
          email: data.email,
          phone: data.phone,
          name: data.name,
          fbp: meta.fbp,
          fbc: meta.fbc,
          clientIpAddress: getClientIp(request.headers),
          clientUserAgent: getClientUserAgent(request.headers),
        },
        customData: {
          content_name: "Catering Inquiry",
          content_category: data.eventType,
          currency: "USD",
        },
      });
    }

    // 6. Return success
    return NextResponse.json({
      success: true,
      message: "Thank you! We'll get back to you within 24 hours.",
    });
  } catch (error) {
    console.error("Catering API error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}