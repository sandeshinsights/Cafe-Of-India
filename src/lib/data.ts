import type { SeoData, SiteConfig, RestaurantData, MenuData } from "./types";
import seoData from "@/data/seo.json";
import siteConfig from "@/data/site-config.json";
import restaurantData from "@/data/restaurant.json";
import menuData from "@/data/menu.json";

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
/**
 * Master switch for taking orders at all — distinct from being outside today's
 * ordering hours, which is a timing message the customer can work around by
 * scheduling. When this is off, nothing goes through: no "order now", no
 * scheduling, and /api/checkout refuses even if the button is bypassed.
 *
 * Two ways to set it, so it can be flipped without touching the code:
 *   NEXT_PUBLIC_ORDERING_DISABLED=true   in the host's settings (fastest)
 *   features.onlineOrdering: false        in site-config.json
 *
 * Reads as enabled unless something explicitly says otherwise — a missing or
 * malformed value must never be what silently stops the restaurant trading.
 */
export function isOnlineOrderingEnabled(): boolean {
  // Deliberately forgiving about how the value is written. This gets flipped
  // in a hurry, on a phone, by someone whose printer just died — "TRUE", "1"
  // and "yes" all have to work, because a switch that silently ignores the
  // wrong casing is worse than no switch.
  const flag = (process.env.NEXT_PUBLIC_ORDERING_DISABLED ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes" || flag === "on") return false;
  return getSiteConfig().features.onlineOrdering !== false;
}
