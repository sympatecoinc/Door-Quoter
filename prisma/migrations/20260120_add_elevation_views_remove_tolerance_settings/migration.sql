-- Add elevation columns to ProductPlanViews
ALTER TABLE "ProductPlanViews" ADD COLUMN "elevationImageData" TEXT;
ALTER TABLE "ProductPlanViews" ADD COLUMN "elevationFileName" TEXT;
ALTER TABLE "ProductPlanViews" ADD COLUMN "elevationFileType" TEXT;

-- Drop ToleranceSettings table
DROP TABLE IF EXISTS "ToleranceSettings";
