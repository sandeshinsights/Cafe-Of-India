import { getSeoData } from "@/lib/data";

/**
 * Robots.txt Generator
 * 
 * WHAT IT DOES:
 * - Automatically generates a robots.txt file
 * - Tells search engines (Google, Bing) to crawl the site
 * - Points to the sitemap URL
 * 
 * HOW IT WORKS:
 * - Next.js automatically converts this to /robots.txt
 * - No manual file needed — it generates dynamically
 */

export default function robots() {
  const seo = getSeoData();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${seo.canonicalUrl}/sitemap.xml`,
  };
}