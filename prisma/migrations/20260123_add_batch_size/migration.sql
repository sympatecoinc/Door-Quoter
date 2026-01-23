-- Add batchSize column to Projects table
ALTER TABLE "Projects" ADD COLUMN IF NOT EXISTS "batchSize" INTEGER;
