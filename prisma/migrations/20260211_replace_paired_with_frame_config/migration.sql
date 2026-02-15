-- AlterTable: Rename pairedProductId to frameConfigId (preserves data)
ALTER TABLE "Products" RENAME COLUMN "pairedProductId" TO "frameConfigId";
