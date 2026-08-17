-- Fulfillment tracking + de-overloading of orders.status
--
-- Adds:
--   fulfilled_at    atomic idempotency claim for fulfillOrder()
--   printed_at      set only when the HP ePrint slip was genuinely accepted
--   uber_status     coarse delivery state, previously written over orders.status
--   dispatch_state  courier dispatch outcome: NULL = not concluded,
--                   'dispatched' = Uber accepted, 'failed' = human must deliver

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfilled_at" TIMESTAMP(3),
ADD COLUMN     "printed_at" TIMESTAMP(3),
ADD COLUMN     "uber_status" TEXT,
ADD COLUMN     "dispatch_state" TEXT;

-- Backfill 1: move delivery states out of `status` into `uber_status`.
-- The Uber webhook used to overwrite `status` with these values, which broke the
-- fulfillment guard and corrupted the `status = 'paid'` counts behind the promo
-- "Nth order" gate and the dispatch-scheduled cron.
UPDATE "orders"
SET "uber_status" = "status"
WHERE "status" IN ('DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED');

UPDATE "orders"
SET "status" = 'paid'
WHERE "status" IN ('DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED');

-- Backfill 2: every order that already reached payment has been fulfilled.
-- Without this, existing orders would have fulfilled_at = NULL, so the first
-- Stripe webhook retry or reopened success-page URL after deploy would claim
-- them as unfulfilled and re-print / re-dispatch them.
--
-- printed_at is backfilled to created_at for the same reason: it is the
-- recovery sweep's "this order still needs a kitchen slip" predicate, and a NULL
-- here would make every historical order look un-printed and get re-printed on
-- the first cron run. It records "handled by the pre-tracking code path", not a
-- verified print — whether these actually printed is unknowable, because the old
-- code logged success unconditionally. Only rows written from here on carry a
-- printed_at that means a genuine ePrint acceptance.
UPDATE "orders"
SET "fulfilled_at" = "created_at",
    "printed_at" = "created_at"
WHERE "status" <> 'pending' AND "fulfilled_at" IS NULL;

-- Backfill 3: dispatch_state for historical delivery orders, so the recovery
-- sweep does not mistake them for crashed-mid-dispatch orders and send a courier
-- to an address that was served (or manually delivered) days ago.
UPDATE "orders"
SET "dispatch_state" = 'dispatched'
WHERE "uber_delivery_id" IS NOT NULL;

-- Non-scheduled delivery orders that never got an Uber delivery were the old
-- manual-fallback path. Scheduled ones are deliberately left NULL: under the old
-- code their dispatch was deferred to the cron, which should still pick them up.
UPDATE "orders"
SET "dispatch_state" = 'failed'
WHERE "is_delivery" = true
  AND "uber_delivery_id" IS NULL
  AND "scheduledFor" IS NULL
  AND "status" <> 'pending';
