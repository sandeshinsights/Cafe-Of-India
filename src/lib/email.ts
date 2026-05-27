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