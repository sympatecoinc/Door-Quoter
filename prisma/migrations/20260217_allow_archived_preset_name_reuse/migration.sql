-- Drop the existing unique constraint on name
DROP INDEX IF EXISTS "OpeningPresets_name_key";

-- Create a partial unique index that only enforces uniqueness on non-archived presets
CREATE UNIQUE INDEX "OpeningPresets_name_active_unique" ON "OpeningPresets" ("name") WHERE "isArchived" = false;

-- Add composite index for name + isArchived lookups
CREATE INDEX "OpeningPresets_name_isArchived_idx" ON "OpeningPresets" ("name", "isArchived");
