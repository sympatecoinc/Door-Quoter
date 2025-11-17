/*
  Warnings:

  - The `status` column on the `Projects` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Staging', 'Approved', 'Revise', 'Quote Sent', 'Quote Accepted', 'Active', 'Complete');

-- AlterTable
ALTER TABLE "ComponentInstances" ADD COLUMN     "includedOptions" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "MasterParts" ADD COLUMN     "optionImageOriginalName" TEXT,
ADD COLUMN     "optionImagePath" TEXT;

-- AlterTable
ALTER TABLE "Products" ADD COLUMN     "installationPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Projects" ADD COLUMN     "installationComplexity" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "installationCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "installationMethod" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "manualInstallationCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'Staging';

-- AlterTable
ALTER TABLE "StockLengthRules" ADD COLUMN     "basePriceBlack" DOUBLE PRECISION,
ADD COLUMN     "basePriceClear" DOUBLE PRECISION,
ADD COLUMN     "isMillFinish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Users" ALTER COLUMN "permissions" SET DEFAULT ARRAY['dashboard', 'projects', 'crm', 'products', 'masterParts', 'quoteDocuments', 'accounting', 'settings']::TEXT[];

-- CreateTable
CREATE TABLE "ProjectStatusHistory" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "changedBy" TEXT,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAttachments" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteAttachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteDocuments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuoteDocuments" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quoteDocumentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductQuoteDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductQuoteDocuments_productId_quoteDocumentId_key" ON "ProductQuoteDocuments"("productId", "quoteDocumentId");

-- AddForeignKey
ALTER TABLE "ProjectStatusHistory" ADD CONSTRAINT "ProjectStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachments" ADD CONSTRAINT "QuoteAttachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuoteDocuments" ADD CONSTRAINT "ProductQuoteDocuments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuoteDocuments" ADD CONSTRAINT "ProductQuoteDocuments_quoteDocumentId_fkey" FOREIGN KEY ("quoteDocumentId") REFERENCES "QuoteDocuments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
