CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerAddress" TEXT,
  "brand" TEXT NOT NULL,
  "btu" TEXT NOT NULL,
  "acType" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "installationPrice" INTEGER NOT NULL DEFAULT 0,
  "installationIncluded" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "convertedAt" TIMESTAMP(3),
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Quote_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "Quote_unitPrice_check" CHECK ("unitPrice" > 0),
  CONSTRAINT "Quote_installationPrice_check" CHECK ("installationPrice" >= 0)
);

CREATE UNIQUE INDEX "Quote_reference_key" ON "Quote"("reference");
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
