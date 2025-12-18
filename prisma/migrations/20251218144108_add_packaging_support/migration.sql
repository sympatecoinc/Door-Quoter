-- AlterTable
ALTER TABLE "Openings" ADD COLUMN     "packagingCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PricingModes" ADD COLUMN     "packagingMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0;
