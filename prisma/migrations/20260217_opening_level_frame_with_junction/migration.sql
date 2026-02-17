-- CreateTable: ProductFrameAssignments (many-to-many junction table)
CREATE TABLE "ProductFrameAssignments" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "frameProductId" INTEGER NOT NULL,

    CONSTRAINT "ProductFrameAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductFrameAssignments_productId_frameProductId_key" ON "ProductFrameAssignments"("productId", "frameProductId");

-- AddForeignKey
ALTER TABLE "ProductFrameAssignments" ADD CONSTRAINT "ProductFrameAssignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFrameAssignments" ADD CONSTRAINT "ProductFrameAssignments_frameProductId_fkey" FOREIGN KEY ("frameProductId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add frameProductId to Openings
ALTER TABLE "Openings" ADD COLUMN "frameProductId" INTEGER;

-- AddForeignKey
ALTER TABLE "Openings" ADD CONSTRAINT "Openings_frameProductId_fkey" FOREIGN KEY ("frameProductId") REFERENCES "Products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
