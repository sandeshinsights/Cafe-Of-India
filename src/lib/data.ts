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