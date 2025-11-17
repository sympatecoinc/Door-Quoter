/*
  Warnings:

  - Made the column `customerId` on table `Projects` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');

-- DropForeignKey
ALTER TABLE "Projects" DROP CONSTRAINT "Projects_customerId_fkey";

-- AlterTable
ALTER TABLE "Openings" ADD COLUMN     "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "priceCalculatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Panels" ADD COLUMN     "componentLibraryId" INTEGER,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Products" ADD COLUMN     "elevationFileName" TEXT,
ADD COLUMN     "elevationImageData" TEXT;

-- AlterTable
ALTER TABLE "Projects" ADD COLUMN     "excludedPartNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "extrusionCostingMethod" TEXT NOT NULL DEFAULT 'FULL_STOCK',
ADD COLUMN     "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "pricingModeId" INTEGER,
ADD COLUMN     "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "customerId" SET NOT NULL;

-- CreateTable
CREATE TABLE "CustomerFiles" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentLibrary" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hasSwingDirection" BOOLEAN NOT NULL DEFAULT false,
    "hasSlidingDirection" BOOLEAN NOT NULL DEFAULT false,
    "elevationImageData" TEXT,
    "planImageData" TEXT,
    "elevationFileName" TEXT,
    "planFileName" TEXT,
    "isParametric" BOOLEAN NOT NULL DEFAULT true,
    "productType" "ProductType" NOT NULL DEFAULT 'Swing Door',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPlanViews" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT NOT NULL DEFAULT 'image/png',
    "orientation" TEXT NOT NULL DEFAULT 'bottom',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlanViews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlassTypes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerSqFt" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlassTypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingModes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extrusionMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hardwareMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "glassMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingModes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT[] DEFAULT ARRAY['dashboard', 'projects', 'crm', 'products', 'masterParts', 'accounting', 'settings']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComponentLibrary_name_key" ON "ComponentLibrary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GlassTypes_name_key" ON "GlassTypes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PricingModes_name_key" ON "PricingModes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Sessions_userId_idx" ON "Sessions"("userId");

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_pricingModeId_fkey" FOREIGN KEY ("pricingModeId") REFERENCES "PricingModes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panels" ADD CONSTRAINT "Panels_componentLibraryId_fkey" FOREIGN KEY ("componentLibraryId") REFERENCES "ComponentLibrary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFiles" ADD CONSTRAINT "CustomerFiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPlanViews" ADD CONSTRAINT "ProductPlanViews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessions" ADD CONSTRAINT "Sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
