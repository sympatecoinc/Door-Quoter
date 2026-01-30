-- CreateEnum
CREATE TYPE "WorkOrderStage" AS ENUM ('STAGED', 'CUTTING', 'ASSEMBLY', 'QC', 'SHIP', 'COMPLETE');

-- CreateTable
CREATE TABLE "WorkOrders" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "currentStage" "WorkOrderStage" NOT NULL DEFAULT 'STAGED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStageHistory" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stage" "WorkOrderStage" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "durationMins" INTEGER,
    "enteredById" INTEGER,
    "exitedById" INTEGER,

    CONSTRAINT "WorkOrderStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderItems" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "partType" TEXT,
    "quantity" INTEGER NOT NULL,
    "openingName" TEXT,
    "productName" TEXT,
    "metadata" JSONB,

    CONSTRAINT "WorkOrderItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStationAssignments" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "station" "WorkOrderStage" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStationAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrders_projectId_idx" ON "WorkOrders"("projectId");

-- CreateIndex
CREATE INDEX "WorkOrders_currentStage_idx" ON "WorkOrders"("currentStage");

-- CreateIndex
CREATE INDEX "WorkOrderStageHistory_workOrderId_idx" ON "WorkOrderStageHistory"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderStageHistory_stage_idx" ON "WorkOrderStageHistory"("stage");

-- CreateIndex
CREATE INDEX "WorkOrderItems_workOrderId_idx" ON "WorkOrderItems"("workOrderId");

-- CreateIndex
CREATE INDEX "UserStationAssignments_userId_idx" ON "UserStationAssignments"("userId");

-- CreateIndex
CREATE INDEX "UserStationAssignments_station_idx" ON "UserStationAssignments"("station");

-- CreateIndex
CREATE UNIQUE INDEX "UserStationAssignments_userId_station_key" ON "UserStationAssignments"("userId", "station");

-- AddForeignKey
ALTER TABLE "WorkOrders" ADD CONSTRAINT "WorkOrders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStageHistory" ADD CONSTRAINT "WorkOrderStageHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStageHistory" ADD CONSTRAINT "WorkOrderStageHistory_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStageHistory" ADD CONSTRAINT "WorkOrderStageHistory_exitedById_fkey" FOREIGN KEY ("exitedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItems" ADD CONSTRAINT "WorkOrderItems_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStationAssignments" ADD CONSTRAINT "UserStationAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
