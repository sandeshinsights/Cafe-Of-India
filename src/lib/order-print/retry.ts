import { Resend } from "resend";
import { FaxResult } from "./types";
import { sendOrderFax } from "./fax-service";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000; // 30 seconds between retries

const resend = new Resend(process.env.RESEND_API_KEY);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyFaxFailure(orderId: string, lastError: string): Promise<void> {
  const toEmail = process.env.RESTAURANT_EMAIL || "cafeofindia2@gmail.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    await resend.emails.send({
      from: `Cafe of India Website <${fromEmail}>`,
      to: [toEmail],
      subject: `ALERT: Order fax failed — #${orderId.slice(0, 8).toUpperCase()}`,
      text: [
        `Order fax failed after ${MAX_RETRIES} attempts.`,
        ``,
        `Order ID: ${orderId}`,
        `Last error: ${lastError}`,
        ``,
        `Please check the order in the system and print manually if needed.`,
        `Customer will still receive their confirmation email.`,
      ].join("\n"),
    });
    console.log(`[OrderPrint] Failure notification sent for order ${orderId.slice(0, 8)}`);
  } catch (err) {
    console.error(`[OrderPrint] Failed to send failure notification:`, err);
  }
}

export async function sendWithRetry(receiptText: string, orderId: string): Promise<void> {
  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result: FaxResult = await sendOrderFax(receiptText, orderId);
    lastError = result.error || "Unknown error";

    if (result.success) {
      console.log(`[OrderPrint] Order ${orderId.slice(0, 8)} fax succeeded on attempt ${attempt}`);
      return;
    }

    console.warn(`[OrderPrint] Order ${orderId.slice(0, 8)} fax failed on attempt ${attempt}/${MAX_RETRIES}: ${lastError}`);

    if (attempt < MAX_RETRIES) {
      console.log(`[OrderPrint] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await delay(RETRY_DELAY_MS);
    }
  }

  // All retries exhausted
  console.error(`[OrderPrint] All retries exhausted for order ${orderId.slice(0, 8)}`);
  await notifyFaxFailure(orderId, lastError);
}