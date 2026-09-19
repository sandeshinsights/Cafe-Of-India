import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { getSeoData } from "@/lib/data";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/CookieConsent";
import CartDrawer from "@/components/CartDrawer";
import MetaPixel from "@/components/MetaPixel";
import { CartProvider } from "@/context/CartContext";
import "./globals.css";

const seo = getSeoData();

// Self-hosted through next/font rather than a Google Fonts <link>: the files
// are served from our own domain at build time, so there is no render-blocking
// request to a third party and no flash of fallback text. Exposed as CSS
// variables that globals.css feeds into the --font-heading / --font-body tokens.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  // Makes every relative canonical / Open Graph URL below (and on the per-dish
  // pages under /menu/[slug]) resolve against the canonical production domain.
  // Without it Next falls back to localhost and warns at build time. Uses
  // seo.canonicalUrl (same source as robots.ts / sitemap.ts) rather than
  // NEXT_PUBLIC_BASE_URL so a preview deploy still points shares at the real
  // site and a malformed env var can't throw here.
  metadataBase: new URL(seo.canonicalUrl),
  title: seo.siteTitle,
  description: seo.siteDescription,
  keywords: seo.keywords,
  openGraph: {
    title: seo.siteTitle,
    description: seo.siteDescription,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: seo.siteTitle,
    description: seo.siteDescription,
  },
  robots: {
    index: seo.robots.index,
    follow: seo.robots.follow,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-body bg-cream text-text-main antialiased">
        <CartProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <CookieConsent />
          <CartDrawer />
          <MetaPixel />
        </CartProvider>
      </body>
    </html>
  );
}