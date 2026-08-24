import { createHash } from "node:crypto";
import { after } from "next/server";

/**
 * Meta Conversions API (CAPI) — the server half of the Meta Pixel integration.
 *
 * WHY BOTH HALVES EXIST: the browser Pixel is blocked for a meaningful slice of
 * traffic (ad blockers, ITP, closed tabs). Every event we send from here is also
 * sent by the browser with the SAME `event_id`, and Meta collapses the pair on
 * (event_name, event_id). Drop the shared event id and Ads Manager double-counts
 * every conversion — which silently halves reported CPA and ruins optimization.
 *
 * ⚠️ NOTHING IN THIS MODULE MAY EVER THROW INTO A CALLER. These are marketing
 * side effects bolted onto the ordering flow; a Meta outage or a bad token must
 * never cost a kitchen slip, a courier, or a customer email. Every send is
 * wrapped, timeboxed, and returns a boolean instead of raising. Use
 * `queueMetaCapiEvent` from request paths so the send also runs *after* the
 * response and adds zero latency to checkout or fulfillment.
 *
 * Unconfigured (no pixel id / no access token) is a no-op, not an error — the
 * site runs exactly as before until the env vars are set.
 */

/**
 * Graph API versions stay callable for roughly two years after release. Pinned
 * rather than floating so Meta's breaking changes land on our schedule; override
 * with META_GRAPH_API_VERSION when this one nears deprecation.
 */
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

/** Hard ceiling on a single CAPI call. Marketing telemetry never gets to hang. */
const REQUEST_TIMEOUT_MS = 5000;

const PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
/** Set only while validating in Events Manager → Test Events. Unset in prod. */
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";

export function isMetaCapiConfigured(): boolean {
  return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

/* ─────────────────────────── PII normalization ─────────────────────────── */

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Meta matches on SHA-256 of a *normalized* value — lowercased and trimmed.
 * Hashing "John@Example.com " instead of "john@example.com" produces a valid
 * hash that simply never matches anyone, so the failure is invisible.
 */
function hashNormalized(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized ? sha256(normalized) : undefined;
}

/**
 * Phones must be digits only, country code included. Customers type
 * "(978) 897-9227", so strip everything else and assume US for bare 10-digit
 * numbers — the only shape this restaurant realistically receives.
 */
function hashPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) digits = `1${digits}`;
  return sha256(digits);
}

/** "Priya Raman" → { first: "priya", last: "raman" }; single names get no last. */
function splitName(fullName: string | null | undefined): {
  first?: string;
  last?: string;
} {
  if (!fullName) return {};
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

/* ────────────────────────────── event types ────────────────────────────── */

export interface MetaUserData {
  email?: string | null;
  phone?: string | null;
  /** Full name; split into first/last before hashing. */
  name?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** Meta's own browser cookies — the strongest ad-click → conversion link. */
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface MetaEventInput {
  /** Standard event name: Purchase, InitiateCheckout, Lead, … */
  eventName: string;
  /** Must be identical to the browser Pixel's `eventID` for the same action. */
  eventId: string;
  eventSourceUrl?: string;
  actionSource?: "website" | "system_generated";
  /** Unix seconds. Defaults to now; Meta rejects events older than 7 days. */
  eventTime?: number;
  userData?: MetaUserData;
  customData?: Record<string, unknown>;
}

/** Drop undefined/empty keys — Meta rejects nulls inside user_data. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function buildUserData(userData: MetaUserData = {}): Record<string, unknown> {
  const { first, last } = splitName(userData.name);

  // Hashed fields go as arrays (Meta's documented shape); fbp/fbc/ip/ua are
  // sent in the clear because they are not PII and Meta expects them raw.
  const hashedEmail = hashNormalized(userData.email);
  const hashedPhone = hashPhone(userData.phone);
  const hashedFirst = hashNormalized(first);
  const hashedLast = hashNormalized(last);
  const hashedCity = hashNormalized(userData.city?.replace(/\s/g, ""));
  const hashedState = hashNormalized(userData.state);
  const hashedZip = hashNormalized(userData.zip);

  return compact({
    em: hashedEmail ? [hashedEmail] : undefined,
    ph: hashedPhone ? [hashedPhone] : undefined,
    fn: hashedFirst ? [hashedFirst] : undefined,
    ln: hashedLast ? [hashedLast] : undefined,
    ct: hashedCity ? [hashedCity] : undefined,
    st: hashedState ? [hashedState] : undefined,
    zp: hashedZip ? [hashedZip] : undefined,
    fbp: userData.fbp || undefined,
    fbc: userData.fbc || undefined,
    client_ip_address: userData.clientIpAddress || undefined,
    client_user_agent: userData.clientUserAgent || undefined,
  });
}

/* ──────────────────────────────── sending ──────────────────────────────── */

/**
 * Send one event to the Conversions API. Resolves `false` on any problem —
 * never rejects. Callers are ordering-flow code paths that must not care.
 */
export async function sendMetaCapiEvent(input: MetaEventInput): Promise<boolean> {
  if (!isMetaCapiConfigured()) return false;

  try {
    const payload = {
      data: [
        compact({
          event_name: input.eventName,
          event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: input.actionSource ?? "website",
          event_source_url: input.eventSourceUrl,
          user_data: buildUserData(input.userData),
          custom_data: input.customData ? compact(input.customData) : undefined,
        }),
      ],
      // Body, not query string: an access token in a URL ends up in access logs.
      access_token: ACCESS_TOKEN,
      ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    };

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[MetaCAPI] ${input.eventName} rejected (${res.status}): ${detail.slice(0, 500)}`
      );
      return false;
    }

    console.log(`[MetaCAPI] ${input.eventName} sent (event_id: ${input.eventId})`);
    return true;
  } catch (err) {
    console.error(
      `[MetaCAPI] ${input.eventName} failed:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Fire-and-forget an event from a request path.
 *
 * Uses `after()` so the HTTP call runs once the response is already on its way
 * to the customer — checkout and fulfillment pay no latency for it. Outside a
 * request scope `after()` throws, so fall back to a detached promise rather than
 * losing the event.
 */
export function queueMetaCapiEvent(input: MetaEventInput): void {
  if (!isMetaCapiConfigured()) return;

  try {
    after(async () => {
      await sendMetaCapiEvent(input);
    });
  } catch {
    void sendMetaCapiEvent(input).catch(() => {});
  }
}

/* ─────────────────────────── request-side helpers ──────────────────────── */

/**
 * The customer's real IP. Vercel puts the client first in `x-forwarded-for`;
 * everything after it is proxy hops.
 */
export function getClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || undefined;
}

export function getClientUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") || undefined;
}
