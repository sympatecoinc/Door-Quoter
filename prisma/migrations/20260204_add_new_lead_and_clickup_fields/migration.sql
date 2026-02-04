-- AlterEnum: Add NEW_LEAD status to ProjectStatus (before Contacted)
ALTER TYPE "ProjectStatus" ADD VALUE 'New Lead' BEFORE 'Contacted';

-- Add ClickUp fields to Projects table for lead sync
ALTER TABLE "Projects" ADD COLUMN "clickupLeadId" TEXT;
ALTER TABLE "Projects" ADD COLUMN "clickupLastSyncedAt" TIMESTAMP(3);

-- Add unique constraint for clickupLeadId
CREATE UNIQUE INDEX "Projects_clickupLeadId_key" ON "Projects"("clickupLeadId");
