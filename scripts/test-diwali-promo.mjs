/**
 * Tests for the DEEWALI / DIWALI promo code (specs/diwali-promo/spec.md).
 *
 * Runs the REAL route handlers and fulfillOrder() with the outside world stubbed:
 * Prisma, Stripe, Uber, Resend and Meta never leave this process, so it needs no
 * env vars and cannot charge a card, print a slip or send a courier. The promo
 * rows are parsed out of the migration file, so the values tested are the values
 * that ship. The SQL itself is not executed here.
 *
 *   node --import ./scripts/ts-alias-hooks.mjs scripts/test-diwali-promo.mjs
 *
 * Exits non-zero on failure.
 */
import { registerHooks } from "node:module";
import { mock } from "node:test";
import { deepStrictEqual } from "node:assert";
import { readFileSync } from "node:fs";

const asModule = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const STUBS = {
  stripe: `export default class {
    checkout = { sessions: {
      create: (p) => globalThis.world.createSession(p),
      retrieve: (id) => globalThis.world.retrieveSession(id),
    } };
  }`,
  resend: `export class Resend {
    emails = { send: async (p) => { globalThis.world.sent.push(p); return { data: { id: "e1" }, error: null }; } };
  }`,
  "next/server": `export class NextRequest {}
    export const NextResponse = { json: (b, i) => Response.json(b, i) };`,
  "@/lib/prisma": `export const prisma = globalThis.world.prisma;`,
  "@/lib/uber-direct": `
    export const getUberQuote = (...a) => globalThis.world.getUberQuote(...a);
    export const createUberDelivery = (a) => globalThis.world.createUberDelivery(a);
    export const getUberDeliveryStatus = async () => ({});`,
  "@/lib/meta-capi": `
    export const queueMetaCapiEvent = (e) => { globalThis.world.capi.push(e); };
    export const getClientIp = () => undefined;
    export const getClientUserAgent = () => undefined;`,
  "@/lib/email": `
    export const sendOrderToPrinter = async (d) => { globalThis.world.emails.push(["print", d]); return true; };
    export const sendOrderNotification = async (d) => { globalThis.world.emails.push(["restaurant", d]); };
    export const sendCustomerConfirmation = async (d) => { globalThis.world.emails.push(["customer", d]); };`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: asModule(STUBS[specifier]), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const MIGRATION = readFileSync(
  new URL("../prisma/migrations/20261103120000_add_diwali_promo_codes/migration.sql", import.meta.url),
  "utf8"
);
const INIT_SQL = readFileSync(new URL("../prisma/migrations/0_init/migration.sql", import.meta.url), "utf8");

const parsedRows = [
  ...MIGRATION.matchAll(
    /\(gen_random_uuid\(\)::text, '(\w+)', '(\w+)', (\d+), NULL, NULL, NULL, NULL,\s+(true|false), '([^']+)', '([^']+)', CURRENT_TIMESTAMP\)/g
  ),
].map(([, code, discountType, value, active, expires, description]) => ({
  id: `id-${code}`,
  code,
  discountType,
  discountValue: Number(value),
  maxUsesPerCustomer: null,
  maxTotalUses: null,
  minOrderAmount: null,
  orderNumber: null,
  usedCount: 0,
  active: active === "true",
  expiresAt: new Date(expires.replace(" ", "T") + "Z"),
  description,
}));

function newWorld() {
  const w = {
    promoRows: parsedRows.map((r) => ({ ...r })),
    promoLookups: 0,
    orders: [],
    sessions: [],
    usages: [],
    capi: [],
    emails: [],
    sent: [],
    quoteCalls: [],
    uberCalls: [],
    createSession: async (params) => {
      const session = { id: `cs_test_${w.sessions.length + 1}`, url: "https://stripe.test/pay", params };
      w.sessions.push(session);
      return session;
    },
    retrieveSession: async (id) => ({ id, payment_status: "paid", metadata: {} }),
    getUberQuote: async (...args) => {
      w.quoteCalls.push(args);
      return { fee: 6 };
    },
    createUberDelivery: async (args) => {
      w.uberCalls.push(args);
      return { deliveryId: "uber-1", status: "pending" };
    },
  };
  w.prisma = {
    promoCode: {
      findUnique: async ({ where }) => {
        w.promoLookups++;
        return w.promoRows.find((r) => (where.id ? r.id === where.id : r.code === where.code)) ?? null;
      },
      update: async ({ where }) => {
        w.promoRows.find((r) => r.id === where.id).usedCount++;
      },
    },
    promoCodeUsage: {
      count: async () => 0,
      create: async ({ data }) => w.usages.push(data),
    },
    order: {
      count: async () => 0,
      create: async ({ data }) => {
        w.orders.push({ id: `order-${w.orders.length + 1}`, fulfilledAt: null, ...data });
      },
      findUnique: async ({ where }) =>
        w.orders.find((o) => (where.id ? o.id === where.id : o.stripeSessionId === where.stripeSessionId)) ?? null,
      updateMany: async ({ where, data }) => {
        const o = w.orders.find((x) => x.id === where.id && x.fulfilledAt === null);
        if (o) Object.assign(o, data);
        return { count: o ? 1 : 0 };
      },
      update: async ({ where, data }) => Object.assign(w.orders.find((x) => x.id === where.id), data),
    },
    $transaction: (ops) => Promise.all(ops),
  };
  return w;
}

// Module-level `prisma` is captured once at import, so the same object is kept
// and its contents swapped between tests.
globalThis.world = newWorld();
const sharedPrisma = globalThis.world.prisma;
function resetWorld() {
  const fresh = newWorld();
  Object.assign(sharedPrisma, fresh.prisma);
  fresh.prisma = sharedPrisma;
  globalThis.world = fresh;
  return fresh;
}

delete process.env.SALES_TAX_RATE;
delete process.env.NEXT_PUBLIC_BASE_URL;

const { POST: checkoutPOST } = await import("../src/app/api/checkout/route.ts");
const { POST: validatePOST } = await import("../src/app/api/promo/validate/route.ts");
const { fulfillOrder } = await import("../src/lib/order-fulfillment.ts");
// The real templates: this path bypasses the "@/lib/email" stub, Resend stays stubbed.
const realEmail = await import("../src/lib/email.ts");

// All clock-dependent code reads Date, so tests set the time directly.
const NOON_NOV_5 = Date.parse("2026-11-05T17:00:00.000Z"); // Thu 12:00 PM Boston
const EXPIRY = Date.parse("2026-11-12T04:59:59.000Z");
mock.timers.enable({ apis: ["Date"], now: NOON_NOV_5 });
const setClock = (ms) => mock.timers.setTime(ms);

const post = (body) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const line = (base, name, price, quantity = 1, extra = {}) => ({
  id: `${base}-none-none-1`, name, price, quantity, ...extra,
});
// Real menu items adding up to exactly $40.00.
const FOOD_40 = [
  line("menu-8", "Cafe Vegetarian Appetizer Platter", 11),
  line("menu-60", "Tandoori Shrimp", 23),
  line("menu-81", "Aloo Paratha", 6),
];
const CUSTOMER = { name: "Test Customer", email: "test@example.com", phone: "9785550100" };
const DELIVERY = { isDelivery: true, deliveryAddress: "1 Main Street, Maynard, MA 01754", deliveryFee: 6 };
const LATE_SLOT = { scheduledDate: "2026-11-12", scheduledTime: "12:00" };

async function checkout(extra = {}, items = FOOD_40) {
  const w = resetWorld();
  const res = await checkoutPOST(post({ ...CUSTOMER, items, ...extra }));
  return { w, status: res.status, json: await res.json(), session: w.sessions[0], order: w.orders[0] };
}
async function validate(code) {
  resetWorld();
  const res = await validatePOST(post({ code, email: CUSTOMER.email }));
  return res.json();
}

const charged = (session) =>
  session.params.line_items.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);
const lineNamed = (session, name) =>
  session.params.line_items.find((l) => l.price_data.product_data.name === name);

const NO_CODE_SCENARIOS = {
  pickup: () => checkout({ meta: { eventId: "evt-1" } }),
  deliveryWithTip: () => checkout({ ...DELIVERY, tipAmount: 5, meta: { eventId: "evt-2" } }),
  proteinMultiQty: () =>
    checkout({}, [
      line("menu-25", "Tikka Masala", 18.99, 2, { protein: "Lamb", spicyLevel: "Medium" }),
      line("menu-81", "Aloo Paratha", 6, 3),
    ]),
};
const describeNoCode = ({ w, status, session, order }) => ({
  status,
  stripeParams: session.params,
  order,
  quoteCalls: w.quoteCalls,
  capi: w.capi,
});

if (process.argv.includes("--print-snapshot")) {
  const out = {};
  for (const [name, run] of Object.entries(NO_CODE_SCENARIOS)) out[name] = describeNoCode(await run());
  console.log(JSON.stringify(out));
  mock.timers.reset();
  process.exit(0);
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  try {
    deepStrictEqual(actual, expected);
    pass++;
  } catch {
    fail++;
    console.log(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
  }
}

// --- the migration ships the agreed values and changes no schema ---
check("migration has exactly two rows", parsedRows.map((r) => r.code), ["DEEWALI", "DIWALI"]);
check("migration inserts data only", /\b(ALTER|DROP|CREATE|TRUNCATE|DELETE|UPDATE)\b/i.test(MIGRATION.replace(/--.*$/gm, "")), false);
check("migration does not overwrite an existing code", MIGRATION.includes(`ON CONFLICT ("code") DO NOTHING`), true);
for (const row of parsedRows) {
  check(`${row.code} is 10 percent`, [row.discountType, row.discountValue], ["PERCENTAGE", 10]);
  check(`${row.code} is active`, row.active, true);
  check(`${row.code} expires at the agreed instant`, row.expiresAt.toISOString(), "2026-11-12T04:59:59.000Z");
  check(
    `${row.code} expiry is end of Nov 11 in Boston`,
    row.expiresAt.toLocaleString("en-US", { timeZone: "America/New_York" }),
    "11/11/2026, 11:59:59 PM"
  );
}
const initTable = INIT_SQL.split(`CREATE TABLE "public"."promo_codes"`)[1].split(");")[0];
const insertColumns = [...MIGRATION.split("VALUES")[0].matchAll(/"(\w+)"/g)]
  .map((m) => m[1])
  .filter((c) => c !== "public" && c !== "promo_codes");
check("every inserted column exists", insertColumns.filter((c) => !initTable.includes(`"${c}"`)), []);
const requiredNoDefault = [...initTable.matchAll(/"(\w+)" [^,]*NOT NULL(?! DEFAULT)[^,]*,/g)]
  .map((m) => m[1])
  .filter((c) => !c.endsWith("_pkey"));
check("every required column is supplied", requiredNoDefault.filter((c) => !insertColumns.includes(c)), []);

// --- code entry: case, whitespace, alias, unknown, expired, inactive ---
for (const code of ["DEEWALI", "deewali", "DeeWaLi", "  deewali  ", "DIWALI", "diwali", " Diwali "]) {
  const r = await validate(code);
  check(`"${code}" is accepted as 10% off`, [r.valid, r.discountType, r.discountValue, r.message], [true, "PERCENTAGE", 10, "10% off!"]);
}
check("alias keeps its own row", (await validate("diwali")).promoCodeId, "id-DIWALI");
check("unknown code", await validate("DEEWALI10"), { valid: false, message: "Invalid promo code." });

setClock(EXPIRY - 1);
check("validate: accepted just before expiry", (await validate("DEEWALI")).valid, true);
setClock(EXPIRY);
check("validate: accepted at the expiry instant", (await validate("DEEWALI")).valid, true);
setClock(EXPIRY + 1);
check("validate: rejected just after expiry", await validate("DEEWALI"), { valid: false, message: "This promo code has expired." });
check("validate: alias rejected after expiry", await validate("DIWALI"), { valid: false, message: "This promo code has expired." });
setClock(NOON_NOV_5);

// --- the worked example from the spec: $40 food, $6 delivery, $5 tip ---
{
  const { status, session, order } = await checkout({ ...DELIVERY, tipAmount: 5, promoCodeId: "id-DEEWALI" });
  check("worked example: accepted", status, 200);
  check(
    "worked example: stored figures",
    [order.subtotal, order.discountAmount, order.tax, order.tipAmount, order.deliveryFee, order.total],
    [40, 4, 2.52, 5, 6, 49.52]
  );
  check("worked example: code saved on the order", order.promoCodeId, "id-DEEWALI");
  check("worked example: tip line not discounted", lineNamed(session, "Tip / Gratuity").price_data.unit_amount, 500);
  check("worked example: delivery line not discounted", lineNamed(session, "Delivery Fee").price_data.unit_amount, 600);
  check("worked example: Stripe charge is food + tip + delivery", charged(session), 4700);
  check("worked example: discount in Stripe metadata", [session.params.metadata.promo_code_id, session.params.metadata.discount_amount], ["id-DEEWALI", "4.00"]);
}

// --- pickup and the alias ---
{
  const { order, session } = await checkout({ promoCodeId: "id-DEEWALI" });
  check("pickup: stored figures", [order.isDelivery, order.discountAmount, order.tax, order.total], [false, 4, 2.52, 38.52]);
  check("pickup: Stripe charge", charged(session), 3600);
  const alias = await checkout({ promoCodeId: "id-DIWALI" });
  check("alias: same discount", [alias.order.discountAmount, alias.order.total], [4, 38.52]);
  check("alias: saved under its own row", alias.order.promoCodeId, "id-DIWALI");
}

// --- the stored discount always equals what Stripe removed ---
{
  const { order, session } = await checkout({ promoCodeId: "id-DEEWALI" }, [line("menu-3", "Gobi 65", 10.99, 7)]);
  check("rounding: helper's overshoot is what gets stored", order.discountAmount, 7.7);
  check("rounding: stored row matches Stripe", Math.round((order.subtotal - order.discountAmount) * 100), charged(session));
}

// --- the browser cannot set prices or the discount ---
{
  const { order, session } = await checkout(
    { promoCodeId: "id-DEEWALI", discountAmount: 999, discountValue: 100, discount_amount: 999 },
    FOOD_40.map((l) => ({ ...l, price: 0.01 }))
  );
  check("tampering: server prices and server discount win", [order.subtotal, order.discountAmount, charged(session)], [40, 4, 3600]);
}

// --- checkout re-checks expiry: code applied in time, paid too late ---
const EXPIRED_MESSAGE = "This promo code has expired. Please remove it to continue.";
setClock(EXPIRY);
{
  const { status, order } = await checkout({ ...LATE_SLOT, promoCodeId: "id-DEEWALI" });
  check("checkout: accepted at the expiry instant", [status, order?.discountAmount], [200, 4.0]);
}
setClock(EXPIRY - 60_000);
{
  const { status, order } = await checkout({ ...LATE_SLOT, promoCodeId: "id-DEEWALI" });
  check("checkout: scheduled past Nov 11 but placed in time keeps the discount", [status, order?.discountAmount], [200, 4]);
}
setClock(EXPIRY + 1);
for (const id of ["id-DEEWALI", "id-DIWALI"]) {
  const { status, json, w } = await checkout({ ...LATE_SLOT, promoCodeId: id });
  check(`checkout: ${id} rejected just after expiry`, [status, json.error], [400, EXPIRED_MESSAGE]);
  check(`checkout: ${id} rejection creates no session or order`, [w.sessions.length, w.orders.length], [0, 0]);
}
setClock(Date.parse("2026-11-12T17:00:00.000Z")); // Thu 12:00 PM Boston, ordering open
{
  const { status, json } = await checkout({ promoCodeId: "id-DEEWALI" });
  check("checkout: rejected the day after, ordering open", [status, json.error], [400, EXPIRED_MESSAGE]);
  const noCode = await checkout({});
  check("checkout: same order with the code removed goes through", [noCode.status, noCode.order.discountAmount, charged(noCode.session)], [200, 0, 4000]);
}
setClock(NOON_NOV_5);

// --- the off switch ---
{
  const w = resetWorld();
  w.promoRows.forEach((r) => { r.active = false; });
  const res = await checkoutPOST(post({ ...CUSTOMER, items: FOOD_40, promoCodeId: "id-DEEWALI" }));
  check("off switch: checkout rejects", [res.status, (await res.json()).error], [400, "This promo code is no longer active. Please remove it to continue."]);
  check("off switch: nothing created", [w.sessions.length, w.orders.length], [0, 0]);
  const v = await validatePOST(post({ code: "DEEWALI", email: CUSTOMER.email }));
  check("off switch: validate rejects", await v.json(), { valid: false, message: "This promo code is no longer active." });
}

// --- after payment: usage recorded, Purchase value, kitchen slip, courier ---
{
  const { w, order } = await checkout({ ...DELIVERY, tipAmount: 5, promoCodeId: "id-DEEWALI" });
  const result = await fulfillOrder(order.stripeSessionId);
  const purchase = w.capi.find((e) => e.eventName === "Purchase");
  check("paid: fulfilled", [result.success, order.status], [true, "paid"]);
  check("paid: Meta Purchase value is subtotal minus discount", purchase.customData.value, 36);
  check("paid: browser Meta/Google value is the same", result.purchase.value, 36);
  check("paid: usage recorded against the code", w.usages.map((u) => [u.promoCodeId, u.discountAmount]), [["id-DEEWALI", 4]]);
  check("paid: usedCount incremented", w.promoRows.find((r) => r.code === "DEEWALI").usedCount, 1);
  check("paid: kitchen slip shows the discount", w.emails.find(([k]) => k === "print")[1].discountAmount, 4);
  for (const [kind, send] of [
    ["restaurant", realEmail.sendOrderNotification],
    ["customer", realEmail.sendCustomerConfirmation],
  ]) {
    const data = w.emails.find(([k]) => k === kind)[1];
    check(`paid: ${kind} email is given the discount`, data.discountAmount, 4);
    await send(data);
    check(`paid: ${kind} email shows the discount line`, w.sent.at(-1).html.includes("Discount: -$4.00"), true);
    await send({ ...data, discountAmount: 0 });
    check(`no discount: ${kind} email has no discount line`, w.sent.at(-1).html.includes("Discount"), false);
  }
  check("paid: Uber request carries no money fields", Object.keys(w.uberCalls[0]).filter((k) => /price|total|amount|fee|discount|value/i.test(k)), []);
}
{
  const { w, order } = await checkout({ promoCodeId: "id-DEEWALI" });
  await fulfillOrder(order.stripeSessionId);
  await fulfillOrder(order.stripeSessionId);
  check("paid: webhook + success page count once", w.usages.length, 1);
}

// --- no code: identical to the code on main before this feature ---
{
  const { w } = await checkout({});
  check("no code: promo table is never read", w.promoLookups, 0);
}
const NO_CODE_SNAPSHOT = {"pickup":{"status":200,"stripeParams":{"payment_method_types":["card"],"line_items":[{"price_data":{"currency":"usd","product_data":{"name":"Cafe Vegetarian Appetizer Platter","description":"Pickup order"},"unit_amount":1100},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Tandoori Shrimp","description":"Pickup order"},"unit_amount":2300},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Aloo Paratha","description":"Pickup order"},"unit_amount":600},"quantity":1}],"mode":"payment","success_url":"http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}","cancel_url":"http://localhost:3000/order/cancelled","metadata":{"customer_name":"Test Customer","customer_email":"test@example.com","customer_phone":"9785550100","promo_code_id":"","discount_amount":"0.00","tip_amount":"0.00","is_delivery":"false","delivery_address":"","delivery_apt":"","delivery_instructions":"","delivery_fee":"0.00"}},"order":{"id":"order-1","fulfilledAt":null,"name":"Test Customer","email":"test@example.com","phone":"9785550100","items":[{"id":"menu-8-none-none-1","name":"Cafe Vegetarian Appetizer Platter","price":11,"quantity":1},{"id":"menu-60-none-none-1","name":"Tandoori Shrimp","price":23,"quantity":1},{"id":"menu-81-none-none-1","name":"Aloo Paratha","price":6,"quantity":1}],"subtotal":40,"tax":2.8,"total":42.8,"discountAmount":0,"tipAmount":0,"stripeSessionId":"cs_test_1","status":"pending","promoCodeId":null,"isDelivery":false,"deliveryAddress":null,"deliveryApt":null,"deliveryInstructions":null,"deliveryFee":0},"quoteCalls":[],"capi":[{"eventName":"InitiateCheckout","eventId":"evt-1","userData":{"email":"test@example.com","phone":"9785550100","name":"Test Customer"},"customData":{"value":40,"currency":"USD","content_type":"product","content_ids":["menu-8","menu-60","menu-81"],"contents":[{"id":"menu-8","quantity":1,"item_price":11},{"id":"menu-60","quantity":1,"item_price":23},{"id":"menu-81","quantity":1,"item_price":6}],"num_items":3}}]},"deliveryWithTip":{"status":200,"stripeParams":{"payment_method_types":["card"],"line_items":[{"price_data":{"currency":"usd","product_data":{"name":"Cafe Vegetarian Appetizer Platter","description":"Delivery order"},"unit_amount":1100},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Tandoori Shrimp","description":"Delivery order"},"unit_amount":2300},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Aloo Paratha","description":"Delivery order"},"unit_amount":600},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Tip / Gratuity","description":"Thank you for your generosity!"},"unit_amount":500},"quantity":1},{"price_data":{"currency":"usd","product_data":{"name":"Delivery Fee","description":"Delivery to your address"},"unit_amount":600},"quantity":1}],"mode":"payment","success_url":"http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}","cancel_url":"http://localhost:3000/order/cancelled","metadata":{"customer_name":"Test Customer","customer_email":"test@example.com","customer_phone":"9785550100","promo_code_id":"","discount_amount":"0.00","tip_amount":"5.00","is_delivery":"true","delivery_address":"1 Main Street, Maynard, MA 01754","delivery_apt":"","delivery_instructions":"","delivery_fee":"6.00"}},"order":{"id":"order-1","fulfilledAt":null,"name":"Test Customer","email":"test@example.com","phone":"9785550100","items":[{"id":"menu-8-none-none-1","name":"Cafe Vegetarian Appetizer Platter","price":11,"quantity":1},{"id":"menu-60-none-none-1","name":"Tandoori Shrimp","price":23,"quantity":1},{"id":"menu-81-none-none-1","name":"Aloo Paratha","price":6,"quantity":1}],"subtotal":40,"tax":2.8,"total":53.8,"discountAmount":0,"tipAmount":5,"stripeSessionId":"cs_test_1","status":"pending","promoCodeId":null,"isDelivery":true,"deliveryAddress":"1 Main Street, Maynard, MA 01754","deliveryApt":null,"deliveryInstructions":null,"deliveryFee":6},"quoteCalls":[["155 Main Street, Maynard, MA 01754","1 Main Street, Maynard, MA 01754",null]],"capi":[{"eventName":"InitiateCheckout","eventId":"evt-2","userData":{"email":"test@example.com","phone":"9785550100","name":"Test Customer"},"customData":{"value":40,"currency":"USD","content_type":"product","content_ids":["menu-8","menu-60","menu-81"],"contents":[{"id":"menu-8","quantity":1,"item_price":11},{"id":"menu-60","quantity":1,"item_price":23},{"id":"menu-81","quantity":1,"item_price":6}],"num_items":3}}]},"proteinMultiQty":{"status":200,"stripeParams":{"payment_method_types":["card"],"line_items":[{"price_data":{"currency":"usd","product_data":{"name":"Tikka Masala","description":"Lamb | Medium"},"unit_amount":2099},"quantity":2},{"price_data":{"currency":"usd","product_data":{"name":"Aloo Paratha","description":"Pickup order"},"unit_amount":600},"quantity":3}],"mode":"payment","success_url":"http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}","cancel_url":"http://localhost:3000/order/cancelled","metadata":{"customer_name":"Test Customer","customer_email":"test@example.com","customer_phone":"9785550100","promo_code_id":"","discount_amount":"0.00","tip_amount":"0.00","is_delivery":"false","delivery_address":"","delivery_apt":"","delivery_instructions":"","delivery_fee":"0.00"}},"order":{"id":"order-1","fulfilledAt":null,"name":"Test Customer","email":"test@example.com","phone":"9785550100","items":[{"id":"menu-25-none-none-1","name":"Tikka Masala","price":20.99,"quantity":2,"protein":"Lamb","spicyLevel":"Medium"},{"id":"menu-81-none-none-1","name":"Aloo Paratha","price":6,"quantity":3}],"subtotal":59.98,"tax":4.2,"total":64.18,"discountAmount":0,"tipAmount":0,"stripeSessionId":"cs_test_1","status":"pending","promoCodeId":null,"isDelivery":false,"deliveryAddress":null,"deliveryApt":null,"deliveryInstructions":null,"deliveryFee":0},"quoteCalls":[],"capi":[]}};
for (const [name, run] of Object.entries(NO_CODE_SCENARIOS)) {
  check(`no code: ${name} identical to main`, JSON.parse(JSON.stringify(describeNoCode(await run()))), NO_CODE_SNAPSHOT?.[name]);
}
{
  const { w, order } = await checkout({ ...DELIVERY, tipAmount: 5 });
  await fulfillOrder(order.stripeSessionId);
  check("no code: no usage row", w.usages.length, 0);
  check("no code: Purchase value is the full subtotal", w.capi.find((e) => e.eventName === "Purchase").customData.value, 40);
}

mock.timers.reset();
console.log(`\n${pass} passed, ${fail} failed`);
// exitCode rather than exit(): a hard exit() trips a libuv assertion on
// Windows while handles are still closing, printing a scary but meaningless error.
process.exitCode = fail ? 1 : 0;
