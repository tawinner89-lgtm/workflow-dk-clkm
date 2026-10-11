ALTER TABLE "Inventory"
  ADD COLUMN "price_ttc" INTEGER;

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_price_ttc_check"
  CHECK ("price_ttc" IS NULL OR "price_ttc" > 0);
