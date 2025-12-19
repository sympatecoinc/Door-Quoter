-- Add optionId column to ProductBOMs
ALTER TABLE "ProductBOMs" ADD COLUMN "optionId" INTEGER;

-- Add foreign key constraint
ALTER TABLE "ProductBOMs" ADD CONSTRAINT "ProductBOMs_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "IndividualOptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create GlassTypeParts table
CREATE TABLE "GlassTypeParts" (
    "id" SERIAL NOT NULL,
    "glassTypeId" INTEGER NOT NULL,
    "masterPartId" INTEGER NOT NULL,
    "formula" TEXT,
    "quantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlassTypeParts_pkey" PRIMARY KEY ("id")
);

-- Create unique index on GlassTypeParts
CREATE UNIQUE INDEX "GlassTypeParts_glassTypeId_masterPartId_key" ON "GlassTypeParts"("glassTypeId", "masterPartId");

-- Add foreign keys to GlassTypeParts
ALTER TABLE "GlassTypeParts" ADD CONSTRAINT "GlassTypeParts_glassTypeId_fkey" FOREIGN KEY ("glassTypeId") REFERENCES "GlassTypes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlassTypeParts" ADD CONSTRAINT "GlassTypeParts_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove columns from IndividualOptions (if they exist)
ALTER TABLE "IndividualOptions" DROP COLUMN IF EXISTS "cutLengthFormula";
ALTER TABLE "IndividualOptions" DROP COLUMN IF EXISTS "quantity";
