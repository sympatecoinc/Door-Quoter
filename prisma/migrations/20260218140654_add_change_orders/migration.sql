-- CreateEnum
CREATE TYPE "COStatus" AS ENUM ('Draft', 'Approved', 'Voided');

-- CreateTable
CREATE TABLE "ChangeOrders" (
    "id" SERIAL NOT NULL,
    "changeOrderNumber" TEXT NOT NULL,
    "salesOrderId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "previousProjectId" INTEGER,
    "status" "COStatus" NOT NULL DEFAULT 'Draft',
    "previousTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deltaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "reason" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrderLines" (
    "id" SERIAL NOT NULL,
    "changeOrderId" INTEGER NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "changeType" TEXT NOT NULL,
    "description" TEXT,
    "previousQty" DOUBLE PRECISION,
    "previousPrice" DOUBLE PRECISION,
    "previousAmount" DOUBLE PRECISION,
    "newQty" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION,
    "newAmount" DOUBLE PRECISION,
    "deltaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrderLines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrders_changeOrderNumber_key" ON "ChangeOrders"("changeOrderNumber");

-- AddForeignKey
ALTER TABLE "ChangeOrders" ADD CONSTRAINT "ChangeOrders_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrders" ADD CONSTRAINT "ChangeOrders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrders" ADD CONSTRAINT "ChangeOrders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderLines" ADD CONSTRAINT "ChangeOrderLines_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
