import { OrderPrintData } from "./types";

export function formatOrderReceipt(data: OrderPrintData): string {
  const items = Array.isArray(data.items) ? data.items : [];
  const now = new Date();

  const dateStr = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const lines: string[] = [];

  lines.push("==========================================");
  lines.push("         CAFE OF INDIA - NEW ORDER         ");
  lines.push("==========================================");
  lines.push("");
  lines.push(`Order: ${data.orderId.slice(0, 8).toUpperCase()}`);
  lines.push(`Date:  ${dateStr}  ${timeStr}`);
  lines.push("");
  lines.push("------------------------------------------");
  lines.push("CUSTOMER");
  lines.push("------------------------------------------");
  lines.push(`Name:  ${data.name}`);
  lines.push(`Phone: ${data.phone}`);
  lines.push(`Email: ${data.email}`);
  lines.push("");
  lines.push("------------------------------------------");
  lines.push("ITEMS");
  lines.push("------------------------------------------");

  items.forEach((item: any) => {
    const name = item.name || "Unknown Item";
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const lineTotal = price * qty;

    let line = `  ${qty}x  ${name}`;
    if (item.protein) line += ` (${item.protein})`;
    if (item.spiceLevel) line += ` [${item.spiceLevel}]`;

    lines.push(line);
    lines.push(`      $${lineTotal.toFixed(2)}`);
  });

  lines.push("------------------------------------------");

  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(`Subtotal:              $${data.subtotal.toFixed(2)}`);
    lines.push(`Discount:             -$${data.discountAmount.toFixed(2)}`);
  } else {
    lines.push(`Subtotal:              $${data.subtotal.toFixed(2)}`);
  }

  lines.push(`Tax (7%):              $${data.tax.toFixed(2)}`);
  lines.push("==========================================");
  lines.push(`TOTAL:                 $${data.total.toFixed(2)}`);
  lines.push("==========================================");
  lines.push("");
  lines.push("--- Pickup Only ---");
  lines.push("155 Main St, Maynard, MA 01754");
  lines.push("(978) 897-9227");
  lines.push("==========================================");

  return lines.join("\n");
}