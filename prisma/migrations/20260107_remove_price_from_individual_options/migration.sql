-- Remove the deprecated price field from IndividualOptions
-- All pricing should now come from MasterPart.cost via partNumber lookup
ALTER TABLE "IndividualOptions" DROP COLUMN IF EXISTS "price";
