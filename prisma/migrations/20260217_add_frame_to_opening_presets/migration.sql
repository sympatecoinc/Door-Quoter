-- AlterTable
ALTER TABLE "OpeningPresets" ADD COLUMN     "frameProductId" INTEGER;

-- AddForeignKey
ALTER TABLE "OpeningPresets" ADD CONSTRAINT "OpeningPresets_frameProductId_fkey" FOREIGN KEY ("frameProductId") REFERENCES "Products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
