-- AlterTable: Remove product-level tolerance columns from Products
ALTER TABLE "Products" DROP COLUMN IF EXISTS "widthTolerance";
ALTER TABLE "Products" DROP COLUMN IF EXISTS "heightTolerance";

-- AlterTable: Remove toleranceProductId from Openings
ALTER TABLE "Openings" DROP COLUMN IF EXISTS "toleranceProductId";
