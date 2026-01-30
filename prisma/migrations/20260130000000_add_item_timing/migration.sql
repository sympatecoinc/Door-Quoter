-- Add per-item timing fields to WorkOrderItems
ALTER TABLE "WorkOrderItems" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "WorkOrderItems" ADD COLUMN "elapsedSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkOrderItems" ADD COLUMN "startedById" INTEGER;

-- Add foreign key constraint for startedBy
ALTER TABLE "WorkOrderItems" ADD CONSTRAINT "WorkOrderItems_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
