-- CreateTable
CREATE TABLE "OpeningPresets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultRoughWidth" DOUBLE PRECISION,
    "defaultRoughHeight" DOUBLE PRECISION,
    "defaultFinishedWidth" DOUBLE PRECISION,
    "defaultFinishedHeight" DOUBLE PRECISION,
    "isFinishedOpening" BOOLEAN NOT NULL DEFAULT false,
    "openingType" TEXT,
    "widthToleranceTotal" DOUBLE PRECISION,
    "heightToleranceTotal" DOUBLE PRECISION,
    "defaultFinishColor" TEXT,
    "includeStarterChannels" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningPresets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningPresetPanels" (
    "id" SERIAL NOT NULL,
    "presetId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "productId" INTEGER,
    "widthFormula" TEXT,
    "heightFormula" TEXT,
    "glassType" TEXT NOT NULL DEFAULT 'Clear',
    "locking" TEXT NOT NULL DEFAULT 'None',
    "swingDirection" TEXT NOT NULL DEFAULT 'None',
    "slidingDirection" TEXT NOT NULL DEFAULT 'Left',
    "subOptionSelections" TEXT NOT NULL DEFAULT '{}',
    "includedOptions" TEXT NOT NULL DEFAULT '[]',
    "variantSelections" TEXT NOT NULL DEFAULT '{}',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningPresetPanels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningPresetParts" (
    "id" SERIAL NOT NULL,
    "presetId" INTEGER NOT NULL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "partName" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT,
    "formula" TEXT,
    "quantity" DOUBLE PRECISION,
    "stockLength" DOUBLE PRECISION,
    "unit" TEXT,
    "isMilled" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningPresetParts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningPresetPartInstances" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "presetPartId" INTEGER NOT NULL,
    "calculatedQuantity" DOUBLE PRECISION NOT NULL,
    "calculatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningPresetPartInstances_pkey" PRIMARY KEY ("id")
);

-- AddColumn to Openings
ALTER TABLE "Openings" ADD COLUMN IF NOT EXISTS "presetId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "OpeningPresets_name_key" ON "OpeningPresets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningPresetPartInstances_openingId_presetPartId_key" ON "OpeningPresetPartInstances"("openingId", "presetPartId");

-- AddForeignKey
ALTER TABLE "Openings" ADD CONSTRAINT "Openings_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OpeningPresets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningPresetPanels" ADD CONSTRAINT "OpeningPresetPanels_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OpeningPresets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningPresetPanels" ADD CONSTRAINT "OpeningPresetPanels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningPresetParts" ADD CONSTRAINT "OpeningPresetParts_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "OpeningPresets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningPresetPartInstances" ADD CONSTRAINT "OpeningPresetPartInstances_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningPresetPartInstances" ADD CONSTRAINT "OpeningPresetPartInstances_presetPartId_fkey" FOREIGN KEY ("presetPartId") REFERENCES "OpeningPresetParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
