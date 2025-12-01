-- AlterTable
ALTER TABLE "MasterParts" ADD COLUMN     "addFinishToPartNumber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "addToPackingList" BOOLEAN NOT NULL DEFAULT false;
