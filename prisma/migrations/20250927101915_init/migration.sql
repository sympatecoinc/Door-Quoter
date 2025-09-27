-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('Swing Door', 'Sliding Door', 'Fixed Panel', '90 Degree Corner');

-- CreateTable
CREATE TABLE "Projects" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "Projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Openings" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "roughWidth" DOUBLE PRECISION,
    "roughHeight" DOUBLE PRECISION,
    "finishedWidth" DOUBLE PRECISION,
    "finishedHeight" DOUBLE PRECISION,
    "finishColor" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panels" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "glassType" TEXT NOT NULL,
    "locking" TEXT NOT NULL,
    "swingDirection" TEXT NOT NULL DEFAULT 'None',
    "slidingDirection" TEXT NOT NULL DEFAULT 'Left',
    "isCorner" BOOLEAN NOT NULL DEFAULT false,
    "cornerDirection" TEXT NOT NULL DEFAULT 'Up',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Product',
    "productType" "ProductType" NOT NULL DEFAULT 'Swing Door',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "withTrim" TEXT NOT NULL DEFAULT 'Without Trim',
    "glassWidthFormula" TEXT,
    "glassHeightFormula" TEXT,
    "glassQuantityFormula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubOptionCategories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubOptionCategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualOptions" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndividualOptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubOptions" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubOptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOMs" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "materialType" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOMs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBOMs" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "partName" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "variable" TEXT,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "stockLength" DOUBLE PRECISION,
    "partNumber" TEXT,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBOMs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentInstances" (
    "id" SERIAL NOT NULL,
    "panelId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "subOptionSelections" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentInstances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterParts" (
    "id" SERIAL NOT NULL,
    "partNumber" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "cost" DOUBLE PRECISION,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "isOption" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterParts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLengthRules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minHeight" DOUBLE PRECISION,
    "maxHeight" DOUBLE PRECISION,
    "minWidth" DOUBLE PRECISION,
    "maxWidth" DOUBLE PRECISION,
    "stockLength" DOUBLE PRECISION,
    "piecesPerUnit" DOUBLE PRECISION,
    "maxLength" DOUBLE PRECISION,
    "maxLengthAppliesTo" TEXT DEFAULT 'height',
    "appliesTo" TEXT NOT NULL DEFAULT 'height',
    "partType" TEXT NOT NULL DEFAULT 'Extrusion',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "basePrice" DOUBLE PRECISION,
    "formula" TEXT,
    "minQuantity" DOUBLE PRECISION,
    "maxQuantity" DOUBLE PRECISION,
    "masterPartId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLengthRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION,
    "formula" TEXT,
    "minQuantity" DOUBLE PRECISION,
    "maxQuantity" DOUBLE PRECISION,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "masterPartId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubOptions_productId_categoryId_key" ON "ProductSubOptions"("productId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentInstances_panelId_key" ON "ComponentInstances"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterParts_partNumber_key" ON "MasterParts"("partNumber");

-- AddForeignKey
ALTER TABLE "Openings" ADD CONSTRAINT "Openings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panels" ADD CONSTRAINT "Panels_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndividualOptions" ADD CONSTRAINT "IndividualOptions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SubOptionCategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubOptions" ADD CONSTRAINT "ProductSubOptions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SubOptionCategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubOptions" ADD CONSTRAINT "ProductSubOptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMs" ADD CONSTRAINT "BOMs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOMs" ADD CONSTRAINT "ProductBOMs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentInstances" ADD CONSTRAINT "ComponentInstances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentInstances" ADD CONSTRAINT "ComponentInstances_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLengthRules" ADD CONSTRAINT "StockLengthRules_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRules" ADD CONSTRAINT "PricingRules_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
