/*
  Warnings:

  - Added the required column `masterPartId` to the `StockLengthRules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Openings" ADD COLUMN "finishColor" TEXT;

-- CreateTable
CREATE TABLE "PricingRules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" REAL,
    "formula" TEXT,
    "minQuantity" REAL,
    "maxQuantity" REAL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "masterPartId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingRules_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MasterParts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partNumber" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "cost" REAL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "category" TEXT,
    "orientation" TEXT,
    "isOption" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MasterParts" ("baseName", "category", "cost", "createdAt", "description", "id", "partNumber", "partType", "unit", "updatedAt") SELECT "baseName", "category", "cost", "createdAt", "description", "id", "partNumber", "partType", "unit", "updatedAt" FROM "MasterParts";
DROP TABLE "MasterParts";
ALTER TABLE "new_MasterParts" RENAME TO "MasterParts";
CREATE UNIQUE INDEX "MasterParts_partNumber_key" ON "MasterParts"("partNumber");
CREATE TABLE "new_Products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Product',
    "productType" TEXT NOT NULL DEFAULT 'Swing Door',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "withTrim" TEXT NOT NULL DEFAULT 'Without Trim',
    "glassWidthFormula" TEXT,
    "glassHeightFormula" TEXT,
    "glassQuantityFormula" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Products" ("archived", "createdAt", "description", "id", "name", "type", "updatedAt", "withTrim") SELECT "archived", "createdAt", "description", "id", "name", "type", "updatedAt", "withTrim" FROM "Products";
DROP TABLE "Products";
ALTER TABLE "new_Products" RENAME TO "Products";
CREATE TABLE "new_StockLengthRules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minHeight" REAL,
    "maxHeight" REAL,
    "minWidth" REAL,
    "maxWidth" REAL,
    "stockLength" REAL,
    "piecesPerUnit" REAL,
    "maxLength" REAL,
    "maxLengthAppliesTo" TEXT DEFAULT 'height',
    "appliesTo" TEXT NOT NULL DEFAULT 'height',
    "partType" TEXT NOT NULL DEFAULT 'Extrusion',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "basePrice" REAL,
    "formula" TEXT,
    "minQuantity" REAL,
    "maxQuantity" REAL,
    "masterPartId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockLengthRules_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StockLengthRules" ("appliesTo", "createdAt", "description", "id", "isActive", "maxHeight", "minHeight", "name", "partType", "stockLength", "updatedAt") SELECT "appliesTo", "createdAt", "description", "id", "isActive", "maxHeight", "minHeight", "name", "partType", "stockLength", "updatedAt" FROM "StockLengthRules";
DROP TABLE "StockLengthRules";
ALTER TABLE "new_StockLengthRules" RENAME TO "StockLengthRules";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
