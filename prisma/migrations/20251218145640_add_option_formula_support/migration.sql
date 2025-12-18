-- AlterTable
ALTER TABLE "IndividualOptions" ADD COLUMN     "cutLengthFormula" TEXT,
ADD COLUMN     "isCutListItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
