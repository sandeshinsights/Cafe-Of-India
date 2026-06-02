import { Resend } from "resend";

/**
 * Email Helper
 * 
 * Sends notification emails using Resend.
 * Used when someone submits the catering form.
 */

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
  const toEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  await resend.emails.send({
    from: `Cafe of India Website <${toEmail}>`,
    to: ["info@cafeindiamaynard.com"],
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
}



/**
 * Order Email Data
 */
interface OrderEmailData {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  items: any;
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Send Order Notification to Restaurant
 * 
 * Called after Stripe payment is verified.
 * Sends full order details to the restaurant email.
 */
export async function sendOrderNotification(data: OrderEmailData) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const restaurantEmail =
    process.env.RESTAURANT_EMAIL || "cafeofindia2@gmail.com";

  // Build items HTML table
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

  await resend.emails.send({
    from: `Cafe of India Website <${fromEmail}>`,
    to: [restaurantEmail],
    subject: `New Order #${data.orderId.slice(0, 8)} from ${data.name} — $${data.total.toFixed(2)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #5C1A1B;">New Order Received!</h2>
        <p>A customer has placed a paid order through the website.</p>

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
            <p style="font-size: 18px; font-weight: bold; color: #5C1A1B; margin: 8px 0;">
              Total: $${data.total.toFixed(2)}
            </p>
          </div>
        </div>

        <div style="margin-top: 20px; padding: 12px; background: #FFF3CD; border-radius: 8px; border-left: 4px solid #C4973B;">
          <strong style="color: #856404;">Order Type:</strong> Pickup Only<br>
          <strong style="color: #856404;">Order ID:</strong> ${data.orderId}
        </div>
      </div>
    `,
  });
}

/**
 * Send Customer Order Confirmation Email
 *
 * Called after a successful order, sends a friendly confirmation
 * to the customer with order details and pickup info.
 */
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

  await resend.emails.send({
    from: `Cafe of India <${fromEmail}>`,
    to: [data.email],
    subject: `Order Confirmed! Your Cafe of India order has been received`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #5C1A1B; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Order Confirmed!</h1>
          <p style="color: #C4973B; margin: 8px 0 0 0;">Thank you for your order</p>
        </div>

        <div style="background: white; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi <strong>${data.name}</strong>,</p>
          <p>We've received your order and are preparing it now. Here are your order details:</p>

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
              <p style="font-size: 20px; font-weight: bold; color: #5C1A1B; margin: 8px 0;">
                Total Paid: $${data.total.toFixed(2)}
              </p>
            </div>
          </div>

          <div style="background: #FBF8F1; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C4973B;">
            <h3 style="color: #5C1A1B; margin-top: 0;">Pickup Information</h3>
            <p style="margin: 4px 0;"><strong>Location:</strong> Cafe of India</p>
            <p style="margin: 4px 0;"><strong>Address:</strong> 155 Main St, Maynard, MA 01754</p>
            <p style="margin: 4px 0;"><strong>Phone:</strong> (978) 897-9227</p>
            <p style="margin: 4px 0;"><strong>Order ID:</strong> ${data.orderId.slice(0, 8)}</p>
          </div>

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