-- AlterTable
ALTER TABLE "SubOptionCategories" ADD COLUMN "svgOriginId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubOptionCategories_svgOriginId_key" ON "SubOptionCategories"("svgOriginId");
