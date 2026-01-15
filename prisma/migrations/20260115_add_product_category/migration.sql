-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('Thinwall', 'Trimmed', 'Both');

-- AlterTable Products
ALTER TABLE "Products" ADD COLUMN "productCategory" "ProductCategory" NOT NULL DEFAULT 'Both';
ALTER TABLE "Products" ADD COLUMN "defaultWidth" DOUBLE PRECISION;

-- AlterTable ProductSubOptions
ALTER TABLE "ProductSubOptions" ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false;
