import type {
  SeoData,
  SiteConfig,
  RestaurantData,
  MenuData,
  MenuItem,
  MenuCategory,
} from "./types";
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
 * Look up one menu item by its id (e.g. "menu-115"), together with the category
 * it sits in. Backs the shareable per-dish pages under `/menu/[slug]`.
 * Returns null for an unknown id so the caller can 404 rather than guess.
 */
export function getMenuItem(
  id: string
): { item: MenuItem; category: MenuCategory } | null {
  for (const category of getMenuData().categories) {
    const item = category.items.find((i) => i.id === id);
    if (item) return { item, category };
  }
  return null;
}

/**
 * Turn a dish name into a URL slug: "Butter Chicken" -> "butter-chicken".
 */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * id <-> slug lookup for the shareable per-dish pages, built once in menu order.
 * The only name clash today is "Plain Yogurt" (menu-89 / menu-90); the later of
 * any clash gets its numeric id appended ("plain-yogurt-90"), and if that is
 * somehow taken too we keep appending "-2", "-3", ... until the slug is free —
 * so `generateStaticParams` can never emit a duplicate. A slug is stable as
 * long as the dish name is — rename a dish and its old shared links 404, which
 * is the trade-off for not hand-maintaining slugs.
 */
let slugMapsCache:
  | { idToSlug: Map<string, string>; slugToId: Map<string, string> }
  | null = null;

function slugMaps() {
  if (slugMapsCache) return slugMapsCache;
  const idToSlug = new Map<string, string>();
  const slugToId = new Map<string, string>();
  for (const category of getMenuData().categories) {
    for (const item of category.items) {
      // Fall back to the id if a name slugifies to nothing (e.g. a name that is
      // all punctuation).
      const base = slugifyName(item.name) || item.id;
      let slug = base;
      if (slugToId.has(slug)) {
        slug = `${base}-${item.id.split("-")[1] ?? item.id}`;
        for (let n = 2; slugToId.has(slug); n++) slug = `${base}-${n}`;
      }
      idToSlug.set(item.id, slug);
      slugToId.set(slug, item.id);
    }
  }
  slugMapsCache = { idToSlug, slugToId };
  return slugMapsCache;
}

/** The URL slug for a menu item id, or null if the id is unknown. */
export function getMenuItemSlug(id: string): string | null {
  return slugMaps().idToSlug.get(id) ?? null;
}

/** Look up a menu item (and its category) by its URL slug. Null if unknown. */
export function getMenuItemBySlug(
  slug: string
): { item: MenuItem; category: MenuCategory } | null {
  const id = slugMaps().slugToId.get(slug);
  return id ? getMenuItem(id) : null;
}

/**
 * Every menu item flattened — item, its category, and its URL slug. Used by the
 * per-dish route's `generateStaticParams` and by the sitemap.
 */
export function getAllMenuItems(): {
  item: MenuItem;
  category: MenuCategory;
  slug: string;
}[] {
  const { idToSlug } = slugMaps();
  return getMenuData().categories.flatMap((category) =>
    category.items.map((item) => ({
      item,
      category,
      slug: idToSlug.get(item.id)!,
    }))
  );
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
