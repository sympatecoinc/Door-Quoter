-- Add pickListStation column (nullable String)
-- Valid values: NULL (not on picklist), 'Jamb Station', 'Assembly'
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "pickListStation" TEXT;

-- Migrate existing data: parts with includeOnPickList=true default to 'Assembly'
UPDATE "MasterParts"
SET "pickListStation" = 'Assembly'
WHERE "includeOnPickList" = true;

-- Drop the old includeOnPickList column
ALTER TABLE "MasterParts" DROP COLUMN IF EXISTS "includeOnPickList";
