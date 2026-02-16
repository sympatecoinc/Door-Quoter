-- AlterTable
ALTER TABLE "ExtrusionVariants" ADD COLUMN     "qtyReserved" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalesOrderParts" ADD COLUMN     "extrusionVariantId" INTEGER;

-- AddForeignKey
ALTER TABLE "SalesOrderParts" ADD CONSTRAINT "SalesOrderParts_extrusionVariantId_fkey" FOREIGN KEY ("extrusionVariantId") REFERENCES "ExtrusionVariants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
