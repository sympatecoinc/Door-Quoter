/*
  Warnings:

  - You are about to drop the column `finishColor` on the `Openings` table. All the data in the column will be lost.
  - You are about to drop the column `basePriceBlack` on the `StockLengthRules` table. All the data in the column will be lost.
  - You are about to drop the column `basePriceClear` on the `StockLengthRules` table. All the data in the column will be lost.
  - You are about to drop the column `isMillFinish` on the `StockLengthRules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Openings" DROP COLUMN "finishColor";

-- AlterTable
ALTER TABLE "StockLengthRules" DROP COLUMN "basePriceBlack",
DROP COLUMN "basePriceClear",
DROP COLUMN "isMillFinish";
