-- Remove formula field from OptionLinkedParts
-- Formulas for cut-length parts should only be set at the product level (ProductBOMs), not at the category level

ALTER TABLE "OptionLinkedParts" DROP COLUMN IF EXISTS "formula";
