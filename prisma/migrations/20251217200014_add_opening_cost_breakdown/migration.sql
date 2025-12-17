-- AlterTable
ALTER TABLE "Openings" ADD COLUMN     "extrusionCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "glassCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "hardwareCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Users" ALTER COLUMN "permissions" SET DEFAULT ARRAY['dashboard', 'projects', 'crm', 'products', 'masterParts', 'vendors', 'quoteDocuments', 'accounting', 'settings']::TEXT[];
