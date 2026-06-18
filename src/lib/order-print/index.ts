import { OrderPrintData } from "./types";
import { formatOrderReceipt } from "./format-receipt";
import { sendWithRetry } from "./retry";

export async function handleOrderPrint(data: OrderPrintData): Promise<void> {
  try {
    const receiptText = formatOrderReceipt(data);
    await sendWithRetry(receiptText, data.orderId);
  } catch (err) {
    // Catch-all so this never crashes the verify-order flow
    console.error("[OrderPrint] Unexpected error:", err);
  }
}