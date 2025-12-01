-- AlterTable
ALTER TABLE "ProductSubOptions" ADD COLUMN     "standardOptionId" INTEGER;

-- AddForeignKey
ALTER TABLE "ProductSubOptions" ADD CONSTRAINT "ProductSubOptions_standardOptionId_fkey" FOREIGN KEY ("standardOptionId") REFERENCES "IndividualOptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
