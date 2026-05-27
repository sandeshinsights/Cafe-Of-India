import type { Metadata } from "next";

/**
 * Terms & Conditions Page
 * 
 * WHAT IT DOES:
 * - Standard terms for the restaurant website
 * - Covers: website use, catering services, online ordering (future), limitations
 */

export const metadata: Metadata = {
  title: "Terms & Conditions | Cafe of India",
  description: "Terms and conditions for Cafe of India restaurant website in Maynard, MA.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-4xl font-bold text-primary mb-8">
          Terms &amp; Conditions
        </h1>

        <div className="bg-white rounded-2xl p-8 md:p-12 space-y-8 text-text-main leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Cafe of India website, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this website.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">2. Website Use</h2>
            <p>
              This website is provided for informational purposes about Cafe of India, including our menu, hours, location, catering services, and other restaurant-related information. You may use this website for lawful purposes only and in accordance with these terms.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">3. Menu &amp; Pricing</h2>
            <p>
              Menu items and prices displayed on this website are for informational purposes and may change without notice. While we strive to keep our website up to date, we cannot guarantee that all prices or items listed are current. Please confirm prices with our restaurant directly.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">4. Catering Services</h2>
            <p>
              Catering inquiries submitted through our website are subject to availability and confirmation by Cafe of India. A minimum order of $150 applies to all catering orders. We require at least 48 hours advance notice for all catering orders. Final pricing, menu selection, and service details will be confirmed directly with our catering team.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">5. Intellectual Property</h2>
            <p>
              All content on this website, including but not limited to text, images, logos, and design elements, is the property of Cafe of India or its content suppliers and is protected by intellectual property laws. You may not reproduce, distribute, or use any content from this website without our prior written permission.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">6. Limitation of Liability</h2>
            <p>
              Cafe of India shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our website. Our website is provided &ldquo;as is&rdquo; without any warranties of any kind, either expressed or implied.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the website following any changes constitutes your acceptance of those changes.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-primary mb-3">8. Contact Us</h2>
            <p>
              If you have any questions about these Terms &amp; Conditions, please contact us at:
            </p>
            <div className="mt-3 text-text-light space-y-1">
              <p><strong>Cafe of India</strong></p>
              <p>155 Main Street, Maynard, MA 01754</p>
              <p>Phone: (978) 897-9227</p>
              <p>Email: info@cafeindiamaynard.com</p>
            </div>
          </section>

          <p className="text-sm text-text-light pt-4 border-t border-gray-200">
            Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}