import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);


interface CateringEmailData {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  guestCount: number;
  eventDate: string;
  message?: string;
}

export async function sendCateringNotification(data: CateringEmailData) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const restaurantEmail = process.env.RESTAURANT_EMAIL || "cafeofindia2@gmail.com";

  const result = await resend.emails.send({
    from: `Cafe of India Website <${fromEmail}>`,
    to: [restaurantEmail],
    replyTo: data.email,
    subject: `New Catering Inquiry from ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #5C1A1B;">New Catering Inquiry</h2>
        <p>A customer has submitted a catering inquiry through the website.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <table style="width: 100%;">
            <tr><td style="padding: 8px 0;"><strong>Name:</strong></td><td>${data.name}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Email:</strong></td><td>${data.email}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Phone:</strong></td><td>${data.phone}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Event Type:</strong></td><td>${data.eventType}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Guest Count:</strong></td><td>${data.guestCount}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Event Date:</strong></td><td>${data.eventDate}</td></tr>
            ${data.message ? `<tr><td style="padding: 8px 0;"><strong>Message:</strong></td><td>${data.message}</td></tr>` : ""}
          </table>
        </div>
        
        <p style="color: #6B6B6B; font-size: 14px;">
          Reply to this customer at <a href="mailto:${data.email}">${data.email}</a> or call <a href="tel:${data.phone}">${data.phone}</a>.
        </p>
      </div>
    `,
  });
  console.log("Catering email Resend response:", JSON.stringify(result));
}

interface OrderEmailData {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  items: any;
  subtotal: number;
  tax: number;
  total: number;
  scheduledFor?: string;
  tipAmount?: number;
  // DELIVERY
  isDelivery?: boolean;
  deliveryAddress?: string | null;
  deliveryApt?: string | null;
  deliveryInstructions?: string | null;
  deliveryFee?: number;
}

export async function sendOrderNotification(data: OrderEmailData) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const restaurantEmail =
    process.env.RESTAURANT_EMAIL || "cafeofindia2@gmail.com";

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsHtml = items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px solid #eee;">
          ${item.name}
          ${item.protein ? ` (${item.protein})` : ""}
          ${item.spiceLevel ? ` &middot; ${item.spiceLevel}` : ""}
          ${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}
        </td>
        <td style="padding: 6px 0; text-align: center; border-bottom: 1px solid #eee;">
          ${item.quantity}
        </td>
        <td style="padding: 6px 0; text-align: right; border-bottom: 1px solid #eee;">
           $${((item.price || 0) * item.quantity).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join("");

  const scheduledBanner = data.scheduledFor
    ? `
      <div style="margin: 16px 0; padding: 14px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.9);">Scheduled Order</p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #fff;">${data.scheduledFor}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.8);">This order is scheduled for future ${data.isDelivery ? "delivery" : "pickup"}. Do NOT prepare yet.</p>
      </div>
    `
    : "";

  const tipHtml = data.tipAmount && data.tipAmount > 0
    ? `<p style="margin: 2px 0;">Tip: $${data.tipAmount.toFixed(2)}</p>`
    : "";

  // DELIVERY: delivery fee line for restaurant email
  const deliveryFeeHtml = data.isDelivery && data.deliveryFee && data.deliveryFee > 0
    ? `<p style="margin: 2px 0;">Delivery Fee: $${data.deliveryFee.toFixed(2)}</p>`
    : "";

  // DELIVERY: address block for restaurant email
  const deliveryAddressHtml = data.isDelivery && data.deliveryAddress
    ? `
      <tr>
        <td style="padding: 4px 0;"><strong>Deliver To:</strong></td>
        <td>${data.deliveryAddress}${data.deliveryApt ? `, ${data.deliveryApt}` : ""}</td>
      </tr>
      ${data.deliveryInstructions ? `
      <tr>
        <td style="padding: 4px 0;"><strong>Delivery Notes:</strong></td>
        <td>${data.deliveryInstructions}</td>
      </tr>
      ` : ""}
    `
    : "";

  const result = await resend.emails.send({
    from: `Cafe of India Website <${fromEmail}>`,
    to: [restaurantEmail],
    subject: `${data.scheduledFor ? "[SCHEDULED] " : ""}${data.isDelivery ? "[DELIVERY] " : ""}New Order #${data.orderId.slice(0, 8)} from ${data.name} — $${data.total.toFixed(2)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #5C1A1B;">${data.scheduledFor ? "Scheduled Order Received!" : "New Order Received!"}</h2>
        <p>${data.scheduledFor ? `A customer has placed a scheduled ${data.isDelivery ? "delivery" : "pickup"} order through the website.` : `A customer has placed a paid ${data.isDelivery ? "delivery" : "pickup"} order through the website.`}</p>

        ${scheduledBanner}

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #5C1A1B;">Customer Details</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 4px 0;"><strong>Name:</strong></td>
              <td>${data.name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Email:</strong></td>
              <td><a href="mailto:${data.email}">${data.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Phone:</strong></td>
              <td><a href="tel:${data.phone}">${data.phone}</a></td>
            </tr>
            ${deliveryAddressHtml}
            ${data.scheduledFor ? `
            <tr>
              <td style="padding: 4px 0;"><strong style="color: #d97706;">Scheduled For:</strong></td>
              <td><strong style="color: #d97706;">${data.scheduledFor}</strong></td>
            </tr>
            ` : ""}
          </table>
        </div>

        <div style="margin: 16px 0;">
          <h3 style="color: #5C1A1B;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #5C1A1B; color: white;">
              <th style="padding: 8px; text-align: left; border-radius: 4px 0 0 0;">
                Item
              </th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right; border-radius: 0 4px 0 0;">
                Price
              </th>
            </tr>
            ${itemsHtml}
          </table>

          <div style="margin-top: 12px; text-align: right;">
            <p style="margin: 2px 0;">Subtotal: $${data.subtotal.toFixed(2)}</p>
            <p style="margin: 2px 0;">Tax (7%): $${data.tax.toFixed(2)}</p>
            ${tipHtml}
            ${deliveryFeeHtml}
            <p style="font-size: 18px; font-weight: bold; color: #5C1A1B; margin: 8px 0;">
              Total: $${data.total.toFixed(2)}
            </p>
          </div>
        </div>

        <div style="margin-top: 20px; padding: 12px; background: ${data.isDelivery ? "#DBEAFE" : "#FFF3CD"}; border-radius: 8px; border-left: 4px solid ${data.isDelivery ? "#3B82F6" : "#C4973B"};">
          <strong style="color: ${data.isDelivery ? "#1E40AF" : "#856404"};">Order Type:</strong> ${data.isDelivery ? "Delivery" : "Pickup Only"}<br>
          <strong style="color: ${data.isDelivery ? "#1E40AF" : "#856404"};">Order ID:</strong> ${data.orderId}
        </div>
      </div>
    `,
  });
}

export async function sendCustomerConfirmation(data: OrderEmailData) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsHtml = items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${item.name}
          ${item.protein ? ` (${item.protein})` : ""}
          ${item.spiceLevel ? ` &middot; ${item.spiceLevel}` : ""}
          ${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}
        </td>
        <td style="padding: 8px 0; text-align: center; border-bottom: 1px solid #eee;">
          ${item.quantity}
        </td>
        <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #eee;">
          $${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join("");

  const scheduledBanner = data.scheduledFor
    ? `
      <div style="margin-bottom: 16px; padding: 14px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.9);">Scheduled Order</p>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #fff;">${data.scheduledFor}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.8);">${data.isDelivery ? "Your order will be delivered at this time." : "Your order will be ready for pickup at this time."}</p>
      </div>
    `
    : "";

  // DELIVERY: dynamic intro text based on fulfillment type
  const introText = data.isDelivery
    ? data.scheduledFor
      ? `We've received your scheduled delivery order. It will be delivered at the scheduled time.`
      : `We've received your order and are preparing it for delivery. Here are your order details:`
    : data.scheduledFor
      ? `We've received your scheduled order. It will be prepared and ready for pickup at the scheduled time.`
      : `We've received your order and are preparing it now. Here are your order details:`;

  // DELIVERY: fulfillment info block — covers all 4 combos (pickup/delivery × ASAP/scheduled)
  const fulfillmentInfo = data.isDelivery
    ? data.scheduledFor
      ? `
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #d97706; margin-top: 0;">Scheduled Delivery</h3>
          <p style="margin: 4px 0; font-size: 16px; font-weight: 600;">${data.scheduledFor}</p>
          <p style="margin: 4px 0;"><strong>Deliver To:</strong> ${data.deliveryAddress || "N/A"}${data.deliveryApt ? `, ${data.deliveryApt}` : ""}</p>
          ${data.deliveryInstructions ? `<p style="margin: 4px 0;"><strong>Instructions:</strong> ${data.deliveryInstructions}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${data.orderId.slice(0, 8)}</p>
          <p style="margin: 8px 0 0; color: #92400e; font-style: italic;">Please ensure someone is available to receive the order at the scheduled time.</p>
        </div>
      `
      : `
        <div style="background: #DBEAFE; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6;">
          <h3 style="color: #1E40AF; margin-top: 0;">Delivery Information</h3>
          <p style="margin: 4px 0;"><strong>Deliver To:</strong> ${data.deliveryAddress || "N/A"}${data.deliveryApt ? `, ${data.deliveryApt}` : ""}</p>
          ${data.deliveryInstructions ? `<p style="margin: 4px 0;"><strong>Instructions:</strong> ${data.deliveryInstructions}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${data.orderId.slice(0, 8)}</p>
        </div>
      `
    : data.scheduledFor
      ? `
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #d97706; margin-top: 0;">Scheduled Pickup</h3>
          <p style="margin: 4px 0; font-size: 16px; font-weight: 600;">${data.scheduledFor}</p>
          <p style="margin: 4px 0;"><strong>Location:</strong> Cafe of India</p>
          <p style="margin: 4px 0;"><strong>Address:</strong> 155 Main St, Maynard, MA 01754</p>
          <p style="margin: 4px 0;"><strong>Phone:</strong> (978) 897-9227</p>
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${data.orderId.slice(0, 8)}</p>
          <p style="margin: 8px 0 0; color: #92400e; font-style: italic;">Please arrive around your scheduled time. Call us if you need to make changes.</p>
        </div>
      `
      : `
        <div style="background: #FBF8F1; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C4973B;">
          <h3 style="color: #5C1A1B; margin-top: 0;">Pickup Information</h3>
          <p style="margin: 4px 0;"><strong>Location:</strong> Cafe of India</p>
          <p style="margin: 4px 0;"><strong>Address:</strong> 155 Main St, Maynard, MA 01754</p>
          <p style="margin: 4px 0;"><strong>Phone:</strong> (978) 897-9227</p>
          <p style="margin: 4px 0;"><strong>Order ID:</strong> ${data.orderId.slice(0, 8)}</p>
        </div>
      `;

  const tipHtml = data.tipAmount && data.tipAmount > 0
    ? `<p style="margin: 4px 0; color: #666;">Tip: $${data.tipAmount.toFixed(2)}</p>`
    : "";

  // DELIVERY: delivery fee line for customer receipt
  const deliveryFeeHtml = data.isDelivery && data.deliveryFee && data.deliveryFee > 0
    ? `<p style="margin: 4px 0; color: #666;">Delivery Fee: $${data.deliveryFee.toFixed(2)}</p>`
    : "";

  const result = await resend.emails.send({
    from: `Cafe of India <${fromEmail}>`,
    to: [data.email],
    subject: `${data.scheduledFor ? "[Scheduled] " : ""}${data.isDelivery ? "[Delivery] " : ""}Order Confirmed! Your Cafe of India order has been received`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #5C1A1B; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Order Confirmed!</h1>
          <p style="color: #C4973B; margin: 8px 0 0 0;">${data.scheduledFor ? "Scheduled Order — Thank You!" : "Thank you for your order"}</p>
        </div>

        <div style="background: white; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi <strong>${data.name}</strong>,</p>
          <p>${introText}</p>

          ${scheduledBanner}

          <div style="margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
              ${itemsHtml}
            </table>

            <div style="margin-top: 16px; text-align: right; padding-top: 12px; border-top: 2px solid #5C1A1B;">
              <p style="margin: 4px 0; color: #666;">Subtotal: $${data.subtotal.toFixed(2)}</p>
              <p style="margin: 4px 0; color: #666;">Tax (7%): $${data.tax.toFixed(2)}</p>
              ${tipHtml}
              ${deliveryFeeHtml}
              <p style="font-size: 20px; font-weight: bold; color: #5C1A1B; margin: 8px 0;">
                Total Paid: $${data.total.toFixed(2)}
              </p>
            </div>
          </div>

          ${fulfillmentInfo}

          <p style="color: #666; font-size: 14px;">
            Questions about your order? Call us at <a href="tel:+19788979227" style="color: #5C1A1B;">(978) 897-9227</a>.
          </p>

          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Cafe of India &middot; 155 Main St, Maynard, MA 01754
            </p>
          </div>
        </div>
      </div>
    `,
  });
}

// ============================================================
// PRINTER ORDER — sends only to HP ePrint for auto-printing
// Called ONLY from verify-order after confirmed Stripe payment
// NEVER connect this to any other email path
// ============================================================

interface PrinterOrderData {
  orderId: string;
  name?: string;
  phone?: string;
  items: any;
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  scheduledFor?: string;
  // DELIVERY: delivery info for kitchen slip
  isDelivery?: boolean;
  deliveryAddress?: string | null;
  deliveryApt?: string | null;
  deliveryInstructions?: string | null;
  deliveryFee?: number;
  // Tip intentionally NOT here — kitchen slip stays clean
}

export async function sendOrderToPrinter(data: PrinterOrderData): Promise<void> {
  const eprintEmail = process.env.HP_EPRINT_EMAIL;
  if (!eprintEmail) {
    console.log("[Printer] HP_EPRINT_EMAIL not configured — skipping print");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const orderNum = data.orderId.slice(0, 8).toUpperCase();
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const items = Array.isArray(data.items) ? data.items : [];

  const itemsHtml = items.length > 0
    ? items.map((item: any) => {
        const qty = item.quantity || 1;
        const price = (item.price || 0) * qty;
        const name = item.name || "Unknown Item";
        const details = [
          item.protein || "",
          item.spiceLevel || "",
          item.specialInstructions || "",
        ]
          .filter(Boolean)
          .join(" | ");

        return `<tr>
          <td style="padding: 4px 0; font-size: 16px;">${qty}x  ${name}</td>
          <td style="padding: 4px 0; text-align: right; font-size: 16px;">$${price.toFixed(2)}</td>
        </tr>${
          details
            ? `<tr><td colspan="2" style="padding: 0 0 8px 24px; font-size: 13px; color: #666;">${details}</td></tr>`
            : ""
        }`;
      }).join("")
    : `<tr><td style="color: #999;">No items found</td></tr>`;

  const discountHtml =
    data.discountAmount && data.discountAmount > 0
      ? `<p style="margin: 4px 0; font-size: 16px; color: #16a34a;">Discount: -$${data.discountAmount.toFixed(2)}</p>`
      : "";

  // DELIVERY: delivery fee line for kitchen slip
  const deliveryFeeHtml = data.isDelivery && data.deliveryFee && data.deliveryFee > 0
    ? `<p style="margin: 4px 0; font-size: 16px; text-align: right;">Delivery Fee: <strong>$${data.deliveryFee.toFixed(2)}</strong></p>`
    : "";

  // DELIVERY: dynamic fulfillment block for kitchen slip
  const fulfillmentBlock = data.scheduledFor
    ? `<div style="margin: 12px 0; padding: 12px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; text-align: center;">
        <p style="margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #92400e; letter-spacing: 1px;">SCHEDULED ${data.isDelivery ? "DELIVERY" : "ORDER"}</p>
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #b45309;">${data.scheduledFor}</p>
        <p style="margin: 4px 0 0; font-size: 14px; color: #92400e; font-weight: 600;">Do NOT prepare yet.</p>
      </div>`
    : data.isDelivery
      ? `<div style="margin: 12px 0; padding: 10px; background: #DBEAFE; border: 2px solid #3B82F6; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1E40AF;">DELIVERY</p>
        </div>`
      : `<div style="margin: 12px 0; padding: 10px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #166534;">PICKUP — Ready in 25-40 min</p>
        </div>`;

  // DELIVERY: address block for kitchen slip
  const deliveryAddressBlock = data.isDelivery && data.deliveryAddress
    ? `<div style="margin: 16px 0;">
        <h3 style="margin: 0 0 8px; font-size: 14px; color: #666; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">DELIVER TO</h3>
        <p style="margin: 2px 0; font-size: 16px;">${data.deliveryAddress}${data.deliveryApt ? `, ${data.deliveryApt}` : ""}</p>
        ${data.deliveryInstructions ? `<p style="margin: 2px 0; font-size: 14px; color: #666;">Instructions: ${data.deliveryInstructions}</p>` : ""}
      </div>`
    : "";

  try {
    await resend.emails.send({
      from: `Cafe of India <${fromEmail}>`,
      to: [eprintEmail],
      subject: `ORDER #${orderNum}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h1 style="text-align: center; margin: 0 0 4px; font-size: 28px; color: #5C1A1B;">CAFE OF INDIA</h1>
          <p style="text-align: center; margin: 0 0 16px; font-size: 14px; color: #666;">155 Main St, Maynard, MA 01754</p>

          <div style="border-top: 3px solid #5C1A1B; border-bottom: 3px solid #5C1A1B; padding: 10px 0; margin: 12px 0; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #666;">Order #</p>
            <p style="margin: 0; font-size: 26px; font-weight: 700; color: #5C1A1B;">${orderNum}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #666;">${now}</p>
          </div>

          ${fulfillmentBlock}

          <div style="margin: 16px 0;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #666; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">CUSTOMER</h3>
            <p style="margin: 2px 0; font-size: 16px;"><strong>Name:</strong> ${data.name || "N/A"}</p>
            <p style="margin: 2px 0; font-size: 16px;"><strong>Phone:</strong> ${data.phone || "N/A"}</p>
          </div>

          ${deliveryAddressBlock}

          <div style="margin: 16px 0;">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #666; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">ITEMS</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${itemsHtml}
            </table>
          </div>

          <div style="margin: 16px 0; padding: 12px; background: #f9f9f9; border-radius: 6px;">
            <p style="margin: 4px 0; font-size: 16px; text-align: right;">Subtotal: <strong>$${data.subtotal.toFixed(2)}</strong></p>
            ${discountHtml}
            <p style="margin: 4px 0; font-size: 16px; text-align: right;">Tax (7%): <strong>$${data.tax.toFixed(2)}</strong></p>
            ${deliveryFeeHtml}
            <div style="border-top: 2px solid #5C1A1B; margin-top: 8px; padding-top: 8px;">
              <p style="margin: 0; font-size: 22px; font-weight: 700; text-align: right; color: #5C1A1B;">TOTAL: $${data.total.toFixed(2)}</p>
            </div>
          </div>

          <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Paid via Stripe &middot; Online Order</p>
        </div>
      `,
    });
    console.log(`[Printer] Order #${orderNum} sent to HP ePrint`);
  } catch (err) {
    console.error(`[Printer] Failed to send order #${orderNum} to printer:`, err);
  }
}