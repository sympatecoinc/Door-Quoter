-- Fix isMilled for non-extrusion parts
-- This migration corrects historical data where Hardware, Fastener, and Packaging
-- parts were incorrectly marked as isMilled=true

-- Step 1: Fix ProductBOMs - set isMilled=false for non-extrusion parts
UPDATE "ProductBOMs"
SET "isMilled" = false
WHERE "partType" NOT IN ('Extrusion', 'CutStock')
  AND "isMilled" = true;

-- Step 2: Fix WorkOrderItems metadata - set isMilled=false for non-extrusion items
UPDATE "WorkOrderItems"
SET "metadata" = jsonb_set(
  COALESCE("metadata", '{}')::jsonb,
  '{isMilled}',
  'false'::jsonb
)
WHERE "partType" NOT IN ('Extrusion', 'CutStock')
  AND "metadata"->>'isMilled' = 'true';
