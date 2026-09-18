CREATE TYPE "CatalogMode" AS ENUM ('CONSUMER', 'COIN');
CREATE TYPE "MoneyUnit" AS ENUM ('USD', 'COIN');
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CompletenessStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');
CREATE TABLE "CatalogBox" (
  "id" TEXT PRIMARY KEY, "sourceKey" TEXT NOT NULL UNIQUE, "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "image" TEXT NOT NULL,
  "mode" "CatalogMode" NOT NULL, "category" TEXT NOT NULL, "tags" TEXT[] NOT NULL,
  "displayOrder" INTEGER NOT NULL, "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "completenessStatus" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "priceMinor" BIGINT NOT NULL CHECK ("priceMinor" >= 0), "priceUnit" "MoneyUnit" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogBox_mode_unit_check" CHECK (("mode" = 'CONSUMER' AND "priceUnit" = 'USD') OR ("mode" = 'COIN' AND "priceUnit" = 'COIN'))
);
CREATE TABLE "CatalogBoxItem" (
  "id" TEXT PRIMARY KEY, "sourceKey" TEXT NOT NULL UNIQUE,
  "boxId" TEXT NOT NULL REFERENCES "CatalogBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL, "image" TEXT NOT NULL, "displayOrder" INTEGER NOT NULL,
  "displayValueMinor" BIGINT NOT NULL CHECK ("displayValueMinor" >= 0), "displayValueUnit" "MoneyUnit" NOT NULL,
  "displayProbabilityPercent" NUMERIC(20,12),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
COMMENT ON COLUMN "CatalogBoxItem"."displayProbabilityPercent" IS 'Reference display only. NEVER use for Opening Engine outcomes or weights.';
CREATE UNIQUE INDEX "CatalogBox_mode_slug_key" ON "CatalogBox"("mode", "slug");
CREATE INDEX "CatalogBox_publicationStatus_mode_displayOrder_id_idx" ON "CatalogBox"("publicationStatus", "mode", "displayOrder", "id");
CREATE INDEX "CatalogBox_publicationStatus_mode_category_displayOrder_id_idx" ON "CatalogBox"("publicationStatus", "mode", "category", "displayOrder", "id");
CREATE INDEX "CatalogBox_publicationStatus_mode_priceMinor_id_idx" ON "CatalogBox"("publicationStatus", "mode", "priceMinor", "id");
CREATE INDEX "CatalogBoxItem_boxId_displayOrder_id_idx" ON "CatalogBoxItem"("boxId", "displayOrder", "id");
