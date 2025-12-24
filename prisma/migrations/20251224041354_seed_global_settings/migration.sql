-- Seed GlobalSettings with default values
-- This ensures the materialPricePerLb setting exists for the Finish Pricing tab

INSERT INTO "GlobalSettings" ("key", "value", "dataType", "category", "description", "createdAt", "updatedAt")
VALUES (
    'materialPricePerLb',
    '1.50',
    'number',
    'pricing',
    'Global aluminum material cost per pound used to calculate extrusion base prices'
    , NOW(), NOW()
)
ON CONFLICT ("key") DO NOTHING;
