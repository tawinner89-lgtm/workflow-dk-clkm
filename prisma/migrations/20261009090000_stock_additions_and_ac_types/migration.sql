ALTER TABLE "Inventory"
  ADD COLUMN IF NOT EXISTS ac_type TEXT NOT NULL DEFAULT 'Split';

ALTER TABLE "SalesLog"
  ADD COLUMN IF NOT EXISTS ac_type TEXT NOT NULL DEFAULT 'Split';

ALTER TABLE "Inventory"
  DROP CONSTRAINT IF EXISTS "Inventory_brand_btu_key";
DROP INDEX IF EXISTS "Inventory_brand_btu_key";
DROP INDEX IF EXISTS "Inventory_brand_btu_ac_type_key";
CREATE UNIQUE INDEX "Inventory_brand_btu_ac_type_key"
  ON "Inventory" (brand, btu, ac_type);

CREATE TABLE IF NOT EXISTS "StockAddition" (
  id SERIAL PRIMARY KEY,
  "inventoryId" INTEGER,
  brand TEXT NOT NULL,
  btu TEXT NOT NULL,
  ac_type TEXT NOT NULL DEFAULT 'Split',
  "quantityAdded" INTEGER NOT NULL CHECK ("quantityAdded" >= 0),
  "addedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StockAddition_createdAt_idx"
  ON "StockAddition" ("createdAt");
