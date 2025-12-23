-- Fix Schema Drift: Add missing columns and tables
-- This migration syncs the staging/production database with schema.prisma

-- =====================================================
-- 1. MasterParts inventory and pick list columns
-- =====================================================
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "qtyOnHand" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "binLocation" TEXT;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "reorderPoint" DOUBLE PRECISION;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "reorderQty" DOUBLE PRECISION;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "vendorId" INTEGER;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "includeOnPickList" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "includeInJambKit" BOOLEAN NOT NULL DEFAULT false;

-- Add foreign key for vendorId on MasterParts (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MasterParts_vendorId_fkey'
    ) THEN
        ALTER TABLE "MasterParts" ADD CONSTRAINT "MasterParts_vendorId_fkey"
        FOREIGN KEY ("vendorId") REFERENCES "Vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- =====================================================
-- 2. Openings columns
-- =====================================================
ALTER TABLE "Openings" ADD COLUMN IF NOT EXISTS "includeStarterChannels" BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 3. Profiles table for user profile management
-- =====================================================
CREATE TABLE IF NOT EXISTS "Profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tabs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profiles_pkey" PRIMARY KEY ("id")
);

-- Add unique index on Profiles.name
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'Profiles_name_key'
    ) THEN
        CREATE UNIQUE INDEX "Profiles_name_key" ON "Profiles"("name");
    END IF;
END
$$;

-- =====================================================
-- 4. Users profile-related columns
-- =====================================================
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "profileId" INTEGER;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "tabOverrides" TEXT NOT NULL DEFAULT '{}';

-- Add foreign key for profileId on Users (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Users_profileId_fkey'
    ) THEN
        ALTER TABLE "Users" ADD CONSTRAINT "Users_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
