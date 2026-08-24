"use client";

/**
 * Meta Pixel — browser-side helpers.
 *
 * The server half lives in `src/lib/meta-capi.ts`. Events that exist on both
 * sides (InitiateCheckout, Purchase, Lead) MUST pass the same `eventId` here and
 * there, or Meta counts the browser copy and the server copy as two conversions.
 *
 * Everything is a no-op when NEXT_PUBLIC_META_PIXEL_ID is unset, so the site
 * behaves exactly as it did before the pixel was configured.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

/** Where a synthesized `_fbc` is parked — see `captureFbclid` below. */
const FBC_STORAGE_KEY = "meta-fbc";

/**
 * The init snippet runs with `afterInteractive`, so a click that happens during
 * hydration can reach `trackMeta` before `window.fbq` exists. Rather than drop
 * the event, retry briefly — the real pixel almost always arrives within a few
 * hundred ms, and an AddToCart is worth more than a saved timer.
 */
const FBQ_RETRY_MS = 200;
const FBQ_MAX_WAIT_MS = 8000;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

/** Opaque id shared with the server copy of the same event, for dedup. */
export function newMetaEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Track a standard Pixel event.
 *
 * @param eventId Pass this ONLY for events the server also sends, and pass the
 *                exact same value to the server. Omitting it on a browser-only
 *                event (PageView, ViewContent, AddToCart) is correct.
 */
export function trackMeta(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (!META_PIXEL_ID || typeof window === "undefined") return;

  const fire = (elapsed: number) => {
    if (typeof window.fbq === "function") {
      try {
        window.fbq(
          "track",
          eventName,
          params ?? {},
          eventId ? { eventID: eventId } : undefined
        );
      } catch {
        // A blocked or stubbed fbq must never break a click handler.
      }
      return;
    }
    if (elapsed >= FBQ_MAX_WAIT_MS) return;
    window.setTimeout(() => fire(elapsed + FBQ_RETRY_MS), FBQ_RETRY_MS);
  };

  fire(0);
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * The `_fbp` / `_fbc` cookies the Pixel sets. These are what tie a conversion
 * back to the ad click, so the server-side events carry them too — which means
 * they have to be read in the browser and handed to our API routes.
 */
export function getMetaBrowserIds(): { fbp?: string; fbc?: string } {
  return {
    fbp: readCookie("_fbp"),
    // Fall back to the value we parked at landing time: if the Pixel was blocked
    // or slow on the landing page, `_fbc` never got written even though the
    // visitor genuinely arrived from an ad.
    fbc: readCookie("_fbc") || readLocalFbc(),
  };
}

function readLocalFbc(): string | undefined {
  try {
    return window.localStorage.getItem(FBC_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Preserve ad-click attribution across the visit.
 *
 * Meta puts `?fbclid=…` on links from ads, and the Pixel turns it into the
 * `_fbc` cookie. That only happens if the Pixel loads on the landing page and
 * the query string is still around — neither is guaranteed. So on first load we
 * build the same `fb.1.<timestamp>.<fbclid>` value ourselves and keep it, giving
 * checkout something to attribute even when the cookie never appeared.
 */
export function captureFbclid(): void {
  if (typeof window === "undefined") return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (!fbclid) return;
    if (readCookie("_fbc")) return; // the Pixel already did the job
    window.localStorage.setItem(
      FBC_STORAGE_KEY,
      `fb.1.${Date.now()}.${fbclid}`
    );
  } catch {
    // Private-mode storage failures are not worth surfacing.
  }
}

/**
 * Cart line ids are composite (`menu-12-Chicken-Mild-1718…`). Meta content ids
 * should be the stable menu item, so audiences and any future catalog line up
 * across orders — the first two dash-segments, exactly as the checkout API
 * recovers the price.
 */
export function toMetaContentId(cartItemId: string): string {
  return cartItemId.split("-").slice(0, 2).join("-");
}
