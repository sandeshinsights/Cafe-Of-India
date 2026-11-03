-- Data-only: adds the Diwali promo codes. No schema change.
-- Running this makes the codes live immediately. Valid through 11:59:59 PM
-- America/New_York on Wed Nov 11, 2026 (EST, UTC-5). To switch them off, set
-- active = false; never delete the rows, because that loses the per-code counts.
INSERT INTO "public"."promo_codes"
  ("id", "code", "discount_type", "discount_value", "max_uses_per_customer",
   "max_total_uses", "min_order_amount", "order_number", "active", "expires_at",
   "description", "updated_at")
VALUES
  (gen_random_uuid()::text, 'DEEWALI', 'PERCENTAGE', 10, NULL, NULL, NULL, NULL,
   true, '2026-11-12 04:59:59', 'Diwali special: 10% off food', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DIWALI', 'PERCENTAGE', 10, NULL, NULL, NULL, NULL,
   true, '2026-11-12 04:59:59', 'Diwali special: 10% off food', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
