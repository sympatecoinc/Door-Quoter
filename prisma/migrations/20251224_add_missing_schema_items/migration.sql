-- Add missing schema items: ExtrusionVariants, GlobalSettings, customPricePerLb
-- This migration syncs the staging/production database with schema.prisma

-- =====================================================
-- 1. MasterParts - Add customPricePerLb column
-- =====================================================
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "customPricePerLb" DOUBLE PRECISION;

-- =====================================================
-- 2. ExtrusionVariants table
-- =====================================================
CREATE TABLE IF NOT EXISTS "ExtrusionVariants" (
    "id" SERIAL NOT NULL,
    "masterPartId" INTEGER NOT NULL,
    "stockLength" DOUBLE PRECISION NOT NULL,
    "finishPricingId" INTEGER,
    "qtyOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "binLocation" TEXT,
    "reorderPoint" DOUBLE PRECISION,
    "reorderQty" DOUBLE PRECISION,
    "pricePerPiece" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtrusionVariants_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on ExtrusionVariants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'ExtrusionVariants_masterPartId_stockLength_finishPricingId_key'
    ) THEN
        CREATE UNIQUE INDEX "ExtrusionVariants_masterPartId_stockLength_finishPricingId_key"
        ON "ExtrusionVariants"("masterPartId", "stockLength", "finishPricingId");
    END IF;
END
$$;

-- Add foreign keys for ExtrusionVariants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ExtrusionVariants_masterPartId_fkey'
    ) THEN
        ALTER TABLE "ExtrusionVariants" ADD CONSTRAINT "ExtrusionVariants_masterPartId_fkey"
        FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ExtrusionVariants_finishPricingId_fkey'
    ) THEN
        ALTER TABLE "ExtrusionVariants" ADD CONSTRAINT "ExtrusionVariants_finishPricingId_fkey"
        FOREIGN KEY ("finishPricingId") REFERENCES "ExtrusionFinishPricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- =====================================================
-- 3. GlobalSettings table
-- =====================================================
CREATE TABLE IF NOT EXISTS "GlobalSettings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'number',
    "category" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

-- Add unique index on GlobalSettings.key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'GlobalSettings_key_key'
    ) THEN
        CREATE UNIQUE INDEX "GlobalSettings_key_key" ON "GlobalSettings"("key");
    END IF;
END
$$;
