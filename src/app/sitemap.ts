import { getSeoData } from "@/lib/data";

/**
 * Sitemap Generator
 * 
 * WHAT IT DOES:
 * - Generates a sitemap.xml for search engines
 * - Lists all public pages on the website
 * - Helps Google and Bing discover and index pages
 * 
 * HOW IT WORKS:
 * - Next.js automatically converts this to /sitemap.xml
 * - Returns an array of pages with their URLs and priorities
 */

export default function sitemap() {
  const seo = getSeoData();
  const baseUrl = seo.canonicalUrl;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
  ];
}