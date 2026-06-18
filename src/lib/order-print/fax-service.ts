import { Resend } from "resend";
import { FaxResult } from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderFax(receiptText: string, orderId: string): Promise<FaxResult> {
  const faxEmail = process.env.ORDER_FAX_EMAIL;

  if (!faxEmail || faxEmail === "PLACEHOLDER_FAX_EMAIL@example.com") {
    console.log(`[OrderPrint] Fax not configured — skipping for order ${orderId.slice(0, 8)}`);
    return { success: true, attempt: 1 };
  }

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [faxEmail],
      subject: `ORDER ${orderId.slice(0, 8).toUpperCase()}`,
      text: receiptText,
    });

    console.log(`[OrderPrint] Fax sent for order ${orderId.slice(0, 8)}:`, JSON.stringify(result));
    return { success: true, attempt: 1 };
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error";
    console.error(`[OrderPrint] Fax failed for order ${orderId.slice(0, 8)}:`, errorMsg);
    return { success: false, attempt: 1, error: errorMsg };
  }
}