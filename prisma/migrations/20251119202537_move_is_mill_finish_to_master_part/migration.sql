/*
  Warnings:

  - You are about to drop the column `isMillFinish` on the `Openings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MasterParts" ADD COLUMN     "isMillFinish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Openings" DROP COLUMN "isMillFinish";
