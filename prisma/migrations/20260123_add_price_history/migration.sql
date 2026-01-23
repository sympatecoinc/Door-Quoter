-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "masterPartId" INTEGER,
    "sku" TEXT,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "previousPrice" DOUBLE PRECISION,
    "priceChange" DOUBLE PRECISION,
    "percentChange" DOUBLE PRECISION,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceHistory_vendorId_idx" ON "PriceHistory"("vendorId");

-- CreateIndex
CREATE INDEX "PriceHistory_masterPartId_idx" ON "PriceHistory"("masterPartId");

-- CreateIndex
CREATE INDEX "PriceHistory_effectiveDate_idx" ON "PriceHistory"("effectiveDate");

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
