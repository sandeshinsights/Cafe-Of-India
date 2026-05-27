import type { Metadata } from "next";
import { getSeoData } from "@/lib/data";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const seo = getSeoData();

export const metadata: Metadata = {
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}