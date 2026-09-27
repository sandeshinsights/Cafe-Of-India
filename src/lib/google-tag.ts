"use client";

/**
 * Google tag (gtag.js) — GA4 analytics and Google Ads conversion tracking.
 *
 * ⚠️ CONSENT-GATED, unlike the Meta Pixel. Nothing Google loads, fires, or
 * stores until the visitor clicks "Accept" on the cookie banner — the privacy
 * policy promises that declining opts out of Google Analytics, and Google Ads
 * rides on the same tag. Every export below checks `hasGoogleConsent()` first.
 * A visitor who declines is invisible to Google, which means Google Ads will
 * under-report conversions by roughly the decline rate. That is the price of
 * the promise; don't quietly remove the gate.
 *
 * Unconfigured is a no-op: with neither NEXT_PUBLIC_GA_ID nor
 * NEXT_PUBLIC_GOOGLE_ADS_ID set, no script loads and no event goes anywhere.
 * Each NEXT_PUBLIC_ value is baked in at build time — a cached redeploy after
 * adding one does nothing.
 *
 * Revenue basis matches Meta: `value` is food revenue (subtotal − discount),
 * never tax, tip or the delivery fee. See `buildPurchaseSummary()` in
 * order-fulfillment.ts.
 */

const GA_PLACEHOLDER = "G-XXXXXXXXXX";
const rawGaId = process.env.NEXT_PUBLIC_GA_ID || "";
export const GA_ID = rawGaId === GA_PLACEHOLDER ? "" : rawGaId;
/** Google Ads account tag, "AW-123456789". */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
/** The part after the slash in a conversion's send_to ("AW-123/<label>"). */
const ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || "";
const ADS_LEAD_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "";

/** Written by CookieConsent. "accepted" | "declined" | absent. */
const CONSENT_STORAGE_KEY = "cookie-consent";
/** Ad-click id banked for checkout — see `captureGoogleClickIds`. */
const CLICK_IDS_STORAGE_KEY = "google-click-ids";
/** Checkout contact details carried across the Stripe redirect, for enhanced conversions. */
const CONTACT_STORAGE_KEY = "google-ec-contact";
/** Order ids whose purchase was already sent — see `trackGooglePurchaseOnce`. */
const PURCHASES_STORAGE_KEY = "google-purchases-sent";
/** Click ids older than Google Ads' maximum click-through window are useless. */
const CLICK_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

declare global {
  interface Window {
    dataLayer?: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(GA_ID || GOOGLE_ADS_ID);
}

export function hasGoogleConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}

function canTrack(): boolean {
  return (
    typeof window !== "undefined" && isGoogleConfigured() && hasGoogleConsent()
  );
}

/**
 * Inject gtag.js and configure GA4 and Google Ads. Idempotent, so both the
 * banner's Accept button and any tracking call can make sure the tag is up.
 *
 * `window.gtag` is a synchronous dataLayer push, so events fired before the
 * script finishes downloading are queued, not lost.
 */
export function loadGoogleTag(): void {
  if (!canTrack() || typeof window.gtag === "function") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads the `arguments` object itself, not an array — this exact
    // shape is Google's snippet and must not be "modernized" to rest params.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  if (GA_ID) window.gtag("config", GA_ID, { anonymize_ip: true });
  // allow_enhanced_conversions lets the hashed email/phone set before a
  // purchase reach Google Ads (enhanced conversions must also be switched on in
  // the Ads UI). The Ads config is also what turns on the conversion linker,
  // which writes the _gcl_aw cookie from a landing page's ?gclid=.
  if (GOOGLE_ADS_ID) {
    window.gtag("config", GOOGLE_ADS_ID, { allow_enhanced_conversions: true });
  }

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID || GOOGLE_ADS_ID}`;
  script.async = true;
  document.head.appendChild(script);
}

/** Send a GA4 event. Recommended ecommerce names: view_item, add_to_cart, … */
export function trackGoogle(eventName: string, params?: Record<string, unknown>): void {
  if (!canTrack()) return;
  try {
    loadGoogleTag();
    window.gtag?.("event", eventName, params ?? {});
  } catch {
    // A blocked or stubbed gtag must never break a click handler.
  }
}

/**
 * Report a Google Ads conversion. Separate from the GA4 event on purpose: this
 * is the native Ads tag, which dedups on `transaction_id` and carries enhanced
 * conversions. Don't ALSO import the GA4 purchase into Ads as a primary
 * conversion — that counts every order twice.
 */
function trackGoogleAdsConversion(label: string, params: Record<string, unknown>): void {
  if (!canTrack() || !GOOGLE_ADS_ID || !label) return;
  try {
    loadGoogleTag();
    window.gtag?.("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${label}`,
      ...params,
    });
  } catch {
    // Same as above: telemetry never breaks the page.
  }
}

/* ────────────────────────────── items ────────────────────────────── */

export interface GoogleItem {
  item_id: string;
  item_name?: string;
  item_category?: string;
  price: number;
  quantity: number;
}

/**
 * Cart line ids are composite (`menu-12-Chicken-Mild-1718…`). The item id is the
 * stable menu id — first two dash-segments, the same recovery the checkout API
 * and the Meta integration use.
 */
export function toGoogleItemId(cartItemId: string): string {
  return cartItemId.split("-").slice(0, 2).join("-");
}

/* ───────────────────────── purchase & lead ───────────────────────── */

/**
 * GA4 purchase + Google Ads purchase conversion, at most once per order per
 * browser. The success page fires this on every load, and a refresh or a
 * revisit would otherwise report the sale again. Google Ads dedups on
 * transaction_id by itself; GA4 cannot be relied on to, so this guard is what
 * keeps its revenue honest.
 */
export function trackGooglePurchaseOnce(purchase: {
  orderId: string;
  value: number;
  items: GoogleItem[];
}): void {
  if (!canTrack()) return;
  if (readSentPurchases().includes(purchase.orderId)) return;

  // Enhanced conversions: gtag hashes these (SHA-256) before they leave the
  // browser. Must be set BEFORE the conversion event it enriches.
  const contact = consumeCheckoutContact();
  if (contact && GOOGLE_ADS_ID) {
    try {
      loadGoogleTag();
      window.gtag?.("set", "user_data", contact);
    } catch {
      // ignore — the conversion still counts without it
    }
  }

  trackGoogle("purchase", {
    transaction_id: purchase.orderId,
    value: purchase.value,
    currency: "USD",
    items: purchase.items,
  });
  trackGoogleAdsConversion(ADS_PURCHASE_LABEL, {
    transaction_id: purchase.orderId,
    value: purchase.value,
    currency: "USD",
  });

  rememberSentPurchase(purchase.orderId);
}

/** GA4 generate_lead + the optional Google Ads lead conversion. */
export function trackGoogleLead(params: { eventType?: string }): void {
  trackGoogle("generate_lead", {
    lead_source: "catering_form",
    event_type: params.eventType || undefined,
  });
  trackGoogleAdsConversion(ADS_LEAD_LABEL, {});
}

function readSentPurchases(): string[] {
  try {
    const raw = window.localStorage.getItem(PURCHASES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberSentPurchase(orderId: string): void {
  try {
    // Only the recent tail matters — nobody refreshes a months-old success page.
    const next = [...readSentPurchases(), orderId].slice(-20);
    window.localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: worst case a refresh double-reports to GA4.
  }
}

/* ───────────────────── enhanced-conversion contact ───────────────────── */

/**
 * Checkout collects the email and phone, but the conversion fires on
 * /order/success after a round trip through Stripe. sessionStorage (same tab,
 * cleared when it closes) carries them across, and the success page deletes
 * them as soon as they are read. Consent-gated like everything else here.
 */
export function rememberCheckoutContact(contact: { email: string; phone: string }): void {
  if (!canTrack() || !GOOGLE_ADS_ID) return;
  try {
    window.sessionStorage.setItem(
      CONTACT_STORAGE_KEY,
      JSON.stringify({
        email: contact.email.trim().toLowerCase(),
        phone_number: toE164(contact.phone),
      })
    );
  } catch {
    // Enhanced conversions are an improvement, not a requirement.
  }
}

function consumeCheckoutContact(): { email?: string; phone_number?: string } | null {
  try {
    const raw = window.sessionStorage.getItem(CONTACT_STORAGE_KEY);
    window.sessionStorage.removeItem(CONTACT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const out: { email?: string; phone_number?: string } = {};
    if (typeof parsed.email === "string" && parsed.email) out.email = parsed.email;
    if (typeof parsed.phone_number === "string" && parsed.phone_number) {
      out.phone_number = parsed.phone_number;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Google wants E.164: "(978) 897-9227" → "+19788979227". US assumed for 10 digits. */
function toE164(phone: string): string | undefined {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) digits = `1${digits}`;
  return `+${digits}`;
}

/* ───────────────────────────── ad-click ids ───────────────────────────── */

/**
 * Ad-click ids from the landing URL, held in memory until we know consent.
 * Client-side navigations keep module state, so a visitor who lands from an ad,
 * browses to a dish page and only then clicks Accept still gets attributed.
 */
let pendingClickIds: GoogleClickIds | null = null;

export interface GoogleClickIds {
  gclid?: string;
  /** iOS app-to-web and web-to-app click ids, used instead of gclid on some iOS traffic. */
  gbraid?: string;
  wbraid?: string;
}

/**
 * Bank the landing page's ?gclid= / ?gbraid= / ?wbraid= so checkout can hand it
 * to the server. Call on load and again on Accept. Pre-consent it only notes
 * the ids in memory; nothing touches storage until the visitor accepts.
 *
 * The gtag conversion linker also stores gclid (the _gcl_aw cookie), but only if
 * the tag loads while ?gclid= is still in the URL — this copy survives the
 * visitor accepting the banner a few pages later.
 */
export function captureGoogleClickIds(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const found: GoogleClickIds = {};
    for (const key of ["gclid", "gbraid", "wbraid"] as const) {
      const value = params.get(key);
      if (value) found[key] = value.slice(0, 200);
    }
    if (Object.keys(found).length) pendingClickIds = found;

    if (!pendingClickIds || !hasGoogleConsent()) return;
    window.localStorage.setItem(
      CLICK_IDS_STORAGE_KEY,
      JSON.stringify({ ...pendingClickIds, at: Date.now() })
    );
    pendingClickIds = null;
  } catch {
    // Private-mode storage failures are not worth surfacing.
  }
}

/** The banked click ids, for /api/checkout. Empty without consent. */
export function getGoogleClickIds(): GoogleClickIds {
  if (!canTrack()) return {};
  try {
    const raw = window.localStorage.getItem(CLICK_IDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CLICK_ID_MAX_AGE_MS) {
      return {};
    }
    return {
      gclid: typeof parsed.gclid === "string" ? parsed.gclid : undefined,
      gbraid: typeof parsed.gbraid === "string" ? parsed.gbraid : undefined,
      wbraid: typeof parsed.wbraid === "string" ? parsed.wbraid : undefined,
    };
  } catch {
    return {};
  }
}
