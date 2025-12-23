-- Add quantity mode fields to ProductBOMs table for user-selectable quantity ranges
ALTER TABLE "ProductBOMs" ADD COLUMN IF NOT EXISTS "quantityMode" VARCHAR(10) DEFAULT 'FIXED';
ALTER TABLE "ProductBOMs" ADD COLUMN IF NOT EXISTS "minQuantity" DOUBLE PRECISION;
ALTER TABLE "ProductBOMs" ADD COLUMN IF NOT EXISTS "maxQuantity" DOUBLE PRECISION;
ALTER TABLE "ProductBOMs" ADD COLUMN IF NOT EXISTS "defaultQuantity" DOUBLE PRECISION;
