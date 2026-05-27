import type { SeoData, SiteConfig, RestaurantData, MenuData } from "./types";
import seoData from "@/data/seo.json";
import siteConfig from "@/data/site-config.json";
import restaurantData from "@/data/restaurant.json";
import menuData from "@/data/menu.json";

/**
 * Centralized data access layer.
 * 
 * HOW IT WORKS:
 * - These functions return the imported JSON data
 * - They run on the SERVER side only (inside React Server Components)
 * - Next.js handles the bundling and caching automatically
 * 
 * WHY THIS PATTERN:
 * - In Phase 1: reads from JSON files (static, fast, no database needed)
 * - In Phase 2-4: we swap these functions to fetch from Supabase API
 * - Components never need to change — they just call getRestaurantData(), getMenuData(), etc.
 */

export function getSeoData(): SeoData {
  return seoData as SeoData;
}

export function getSiteConfig(): SiteConfig {
  return siteConfig as SiteConfig;
}

export function getRestaurantData(): RestaurantData {
  return restaurantData as RestaurantData;
}

export function getMenuData(): MenuData {
  return menuData as MenuData;
}