# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above pulls in `AGENTS.md`: **this is Next.js 16 + React 19**, which has breaking changes vs. older versions. Read the relevant guide under `node_modules/next/dist/docs/` before writing framework code.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint.config.mjs)
npx prisma generate   # regenerate Prisma client (also runs automatically on postinstall)
npx prisma migrate dev --name <name>   # create + apply a migration locally
npx prisma db push    # push schema without a migration
```

There is **no test framework** in this project — do not assume `npm test` exists.

## Big picture

A single-page marketing + online-ordering site for one restaurant (Cafe of India, Maynard MA). The homepage (`src/app/page.tsx`) stacks nine section components in a fixed order; there are no other content pages besides `/order/success`, `/order/cancelled`, `/privacy`, `/terms`. All real logic lives in the API routes and `src/lib`.

**Content vs. code split.** All copy, menu, hours-independent config, theme colors, and SEO live in `src/data/*.json` and are read *only* through the typed accessors in `src/lib/data.ts` (`getMenuData`, `getRestaurantData`, `getSiteConfig`, `getSeoData`). Types for every JSON shape are in `src/lib/types.ts`. To change menu items, prices, hours copy, testimonials, FAQ, etc., edit the JSON — not the components. `site-config.json` also holds `features` flags and the theme palette (which is mirrored as CSS variables in `src/app/globals.css` `@theme`).

**Styling.** Tailwind v4 (via `@tailwindcss/postcss`), configured entirely in `globals.css` with the `@theme` block — there is no `tailwind.config.js`. Brand colors exist both as Tailwind tokens (`bg-primary`, `text-secondary`, `bg-cream`) and as hardcoded hex literals (`#5C1A1B` primary, `#C4973B` secondary/gold, `#FBF8F1` cream) sprinkled through components. Fonts (Playfair Display headings, Inter body) load via Google Fonts `<link>` in `layout.tsx`.

**Cart.** `src/context/CartContext.tsx` is a client-side provider wrapping the whole app in `layout.tsx`; it persists to `localStorage` under `cafe-of-india-cart`. Tax rate is duplicated as a constant here (`0.07`) for display and independently on the server for the real charge.

## Ordering flow (the core system)

1. **Menu → cart** (`src/components/sections/Menu.tsx`): Each cart line gets a composite id: `` `${baseItemId}-${protein}-${spice}-${Date.now()}` ``. The menu item ids in `menu.json` are two dash-segments (e.g. `dinner-korma`); the trailing option/timestamp segments make otherwise-identical items distinct in the cart. Protein choice ("Dinner" category) and spice level (6 named categories) are required before add; protein surcharges are added client-side.
2. **Checkout** (`src/app/api/checkout/route.ts`): **Never trusts client prices.** `getMenuItemPrice` recovers the base id by taking the first two dash-segments of the cart id and looks the price up in `menu.json` — so the composite-id format above is load-bearing. Recomputes subtotal/tax/discount server-side, validates the promo code, then creates a Stripe Checkout Session (pinned `apiVersion`, currently `2026-05-27.dahlia`) and writes an `Order` row with `status: "pending"`. Discount is applied by shrinking the first Stripe line item; tip and delivery fee are separate line items. Ordering-window / scheduled-time rules are enforced here via `src/lib/ordering-hours.ts`.
3. **Payment**: Stripe redirects to `/order/success?session_id=...`.
4. **Fulfillment runs twice, independently:**
   - `src/app/api/stripe/webhook/route.ts` — verifies the Stripe signature, then on `checkout.session.completed` calls the shared `fulfillOrder()` helper in `src/lib/order-fulfillment.ts`.
   - `src/app/api/verify-order/route.ts` — the success page POSTs the session id here on load. It **re-implements the same steps inline** rather than calling `fulfillOrder()`: re-checks `payment_status` with Stripe, flips the order to `"paid"`, records `PromoCodeUsage`, sends the three emails, and dispatches/defers the Uber delivery.
   - Both paths guard idempotency the same way — `if (order.status === "paid") return early` — and both duplicate the delivery-dispatch and email logic. **Keep the two in sync**; if you change one, change the other (or finish migrating `verify-order` to call `fulfillOrder()` and delete the duplicate).
5. **Emails**: three sent via `src/lib/email.ts` on the first fulfillment pass: restaurant notification, customer confirmation, and a kitchen slip to the HP ePrint printer.

**⚠️ `Order.status` is overloaded.** It starts as `"pending"` → `"paid"` (checkout/fulfillment lifecycle), but `src/app/api/uber/webhook/route.ts` later overwrites the *same column* with delivery-tracking values (`DRIVER_ASSIGNED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`) once a delivery is under way. After that happens, `order.status === "paid"` is false again, so the idempotency guards in `fulfillOrder()` and `verify-order` no longer recognize the order as already-fulfilled — a stale/replayed webhook or a success-page refresh after delivery status changes could re-send confirmation emails and re-attempt Uber dispatch. Be aware of this if you touch either fulfillment path or the uber webhook.

**Money/tax invariants worth preserving:** server tax rate comes from `SALES_TAX_RATE` (default `0.07`); tax is charged on the *discounted* subtotal; tip is never taxed and is deliberately omitted from the printer/kitchen slip.

## Domain-specific modules

- **`src/lib/ordering-hours.ts`** — all pickup-time logic, hardcoded to `America/New_York`. `ORDERING_CONFIG` holds open/close and lead-time constants. Handles both "order now" (window must be open) and scheduled orders (today + 7 days, 15-min slots, 30-min lead). `isValidScheduledTime` re-validates on the server; the client picker is `src/components/TimeSlotPicker.tsx`.
- **Delivery / Uber Direct — live, not mocked.** `src/lib/uber-direct.ts` is the only module that calls Uber's API directly (OAuth token caching, quote, create delivery, get status). `src/lib/delivery.ts` holds `DELIVERY_CONFIG` (min order $20, 10 mile radius, `feeType: "uber_quote"`) and is the **client-side** entry point: `getDeliveryQuote`/`createDelivery` call our own `/api/delivery/quote` and `/api/delivery/create` routes over `fetch` rather than importing `uber-direct.ts` — that file's own comment ("only the API routes call Uber directly") is now only half true, since the *server-side* fulfillment paths (`order-fulfillment.ts`, `verify-order/route.ts`, `cron/dispatch-scheduled/route.ts`) import `uber-direct.ts` functions directly, skipping the API-route hop entirely because they already run server-side.
  - `/api/delivery/quote` — address → Uber quote; on any Uber error it returns HTTP 422 and blocks checkout (no silent flat-fee fallback for quoting). Accepts an optional `scheduledFor`, which is forwarded to Uber as `pickup_ready_dt` so scheduled orders get a scheduled-delivery quote.
  - Post-payment dispatch: fulfillment **always creates the Uber delivery immediately**, regardless of pickup time. For scheduled orders it passes `pickup_ready_dt` (both `getUberQuote` and `createUberDelivery` accept it) and lets Uber own the timing, rather than deferring dispatch. The `vercel.json` cron (`0 10 * * *` — daily, constrained by the Vercel Hobby plan's daily-cron limit; see commit `c86f01e`) → `/api/cron/dispatch-scheduled`, guarded by a `CRON_SECRET` bearer token, is now only a **safety-net fallback**: it dispatches any `paid` delivery order scheduled within the next 30 min that still has a null `uberDeliveryId`. Because normal dispatch happens inline at fulfillment, this cron should rarely find work. On Uber failure, fulfillment sets `deliveryType = "manual_fallback"` instead of deferring.
  - `/api/uber/webhook` — receives Uber delivery status callbacks and writes them into `Order.uberDeliveryStatus` (and, for certain statuses, `Order.status` — see the overloaded-status warning above).
- **`src/lib/email.ts`** — all transactional email via Resend, as inline-HTML templates. Four senders: `sendCateringNotification`, `sendOrderNotification` (restaurant), `sendCustomerConfirmation` (customer), `sendOrderToPrinter` (HP ePrint kitchen slip). The printer path is intentionally isolated — do not wire it into other email flows.
- **Promo codes** (`src/app/api/promo/validate/route.ts` + checkout): codes support percentage/fixed discounts, per-customer and total use caps, min order, expiry, and an `orderNumber` "Nth order" gate that counts the customer's prior *paid* orders. Validation logic is duplicated between the validate endpoint (for UI feedback) and checkout (authoritative) — keep them in sync.

## Data layer

- **Prisma + PostgreSQL (Supabase).** `schema.prisma` uses `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for migrations). Models: `Order`, `CateringInquiry`, `PromoCode`, `PromoCodeUsage`. Column names are snake_case in the DB via `@map`. `Order.items` is a JSON blob (the cart snapshot). `Order` also carries delivery fields (`isDelivery`, `deliveryAddress`, `deliveryApt`, `deliveryInstructions`, `deliveryFee`, `uberDeliveryId`, `uberDeliveryStatus`), `scheduledFor`, and `tipAmount`. `src/lib/prisma.ts` is the standard hot-reload-safe singleton.
- **`src/lib/supabase.ts`** exists but the app talks to the DB through Prisma, not the Supabase JS client.

## Environment variables

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESTAURANT_EMAIL`, `HP_EPRINT_EMAIL`, `SALES_TAX_RATE`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UBER_DIRECT_CUSTOMER_ID`, `UBER_DIRECT_CLIENT_ID`, `UBER_DIRECT_CLIENT_SECRET`, `CRON_SECRET`. `.env*` is gitignored. Deploys to Vercel (`vercel.json` also defines the dispatch-scheduled cron).
