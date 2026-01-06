-- Restore price field to IndividualOptions
-- This field was accidentally removed but is needed for option pricing in quotes

ALTER TABLE "IndividualOptions" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
