-- Remove orientation column from MasterParts table
ALTER TABLE "MasterParts" DROP COLUMN IF EXISTS "orientation";