-- CreateTable
CREATE TABLE "OptionLinkedParts" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "masterPartId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionLinkedParts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OptionLinkedParts_optionId_masterPartId_key" ON "OptionLinkedParts"("optionId", "masterPartId");

-- AddForeignKey
ALTER TABLE "OptionLinkedParts" ADD CONSTRAINT "OptionLinkedParts_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "IndividualOptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionLinkedParts" ADD CONSTRAINT "OptionLinkedParts_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
