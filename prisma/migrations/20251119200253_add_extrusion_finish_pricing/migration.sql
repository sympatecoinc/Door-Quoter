-- AlterTable
ALTER TABLE "Openings" ADD COLUMN     "finishColor" TEXT;

-- CreateTable
CREATE TABLE "ExtrusionFinishPricing" (
    "id" SERIAL NOT NULL,
    "finishType" TEXT NOT NULL,
    "costPerFoot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtrusionFinishPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtrusionFinishPricing_finishType_key" ON "ExtrusionFinishPricing"("finishType");
