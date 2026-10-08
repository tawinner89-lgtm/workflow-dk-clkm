-- Match the Prisma @@unique([brand, btu]) constraint used by inventory APIs.
-- Existing duplicates must be reconciled before this migration can succeed.
CREATE UNIQUE INDEX IF NOT EXISTS "Inventory_brand_btu_key"
ON "Inventory" ("brand", "btu");
