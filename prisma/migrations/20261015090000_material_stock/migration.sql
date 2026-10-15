CREATE TABLE "StockMaterial" (
  "id" SERIAL NOT NULL,
  "designation" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "price" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMaterial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMaterial_designation_key" ON "StockMaterial"("designation");

CREATE TABLE "MaterialMovement" (
  "id" SERIAL NOT NULL,
  "materialId" INTEGER,
  "designation" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "quantityBefore" INTEGER,
  "quantityAfter" INTEGER,
  "priceBefore" DECIMAL(12,2),
  "priceAfter" DECIMAL(12,2),
  "performedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StockMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MaterialMovement_createdAt_idx" ON "MaterialMovement"("createdAt");

INSERT INTO "StockMaterial" ("designation", "quantity") VALUES
('Flexible isole DIAM 160 (10m)', 20),
('Plaque Pipal de 4.8 m2', 5),
('Grille simple deflexion 500/100', 10),
('Grille simple deflexion 600/150', 10),
('Support GM', 30),
('Flexible isole DIAM 200 (10m)', 5),
('Support PM', 40),
('Clapet motorise diam 160 en acier', 10),
('Ventilateur de gaine diam 160 en PVC', 5),
('Carte universelle', 2),
('Ventilateur de gaine diam 160 en acier', 5),
('Regulateur de temperature claper tactile', 10),
('Scotch aluminium', 10),
('Scotch grisse / emballage', 10),
('Silicone 500g', 10),
('Bouteille de chalumeau', 10),
('Tube de vidange 19 (25m)', 10),
('Flexible souple Diam 100 (10m)', 10),
('Flexible souple Diam 125', 1),
('Grille simple deflexion 400/100', 10),
('Diffuseur carre diam 600*600/450*450', 10),
('Diffuseur lineaire diam 500/1fente', 10),
('Diffuseur lineaire diam 1000/1fente', 10),
('Grille double deflexion 500/100', 10),
('Grille double deflexion 400/100', 10),
('Grille a barre fixe 800/100', 10),
('Bitube cuivre 1/4 1/2 20ml', 3),
('Bitube cuivre 3/8 5/8 20ml', 3),
('Plaque Pipal de 3.8 m2', 5),
('Couronne cuivre 1/2', 3),
('Couronne cuivre 1/4', 3),
('Couronne cuivre 3/4', 3),
('Couronne cuivre 3/8', 3),
('Couronne cuivre 5/8', 3),
('Tube isolant 9*12', 48),
('Tube isolant 9*6', 48),
('Tube isolant 9*18', 48),
('Cuivre isole 5/8 3/8 (m)', 60),
('Cuivre isole 1/4 3/8 (m)', 60),
('Cuivre isole 3/8 1/4 (m)', 20),
('Telecommande', 3),
('Tube isolant 9*15', 48),
('Tube isolant 9*10', 48)
ON CONFLICT ("designation") DO NOTHING;

INSERT INTO "MaterialMovement" ("materialId", "designation", "action", "quantityAfter", "performedBy")
SELECT "id", "designation", 'INITIAL_STOCK', "quantity", 'Import initial'
FROM "StockMaterial";
