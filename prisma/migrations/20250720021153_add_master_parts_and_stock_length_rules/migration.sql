/*
  Warnings:

  - You are about to drop the column `materialType` on the `ProductBOMs` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MasterParts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partNumber" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "cost" REAL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockLengthRules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minHeight" REAL,
    "maxHeight" REAL,
    "stockLength" REAL NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'height',
    "partType" TEXT NOT NULL DEFAULT 'Extrusion',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductBOMs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "partName" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "variable" TEXT,
    "unit" TEXT,
    "quantity" REAL,
    "stockLength" REAL,
    "partNumber" TEXT,
    "cost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBOMs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductBOMs" ("createdAt", "description", "formula", "id", "partName", "partNumber", "partType", "productId", "stockLength", "unit", "updatedAt", "variable") SELECT "createdAt", "description", "formula", "id", "partName", "partNumber", "partType", "productId", "stockLength", "unit", "updatedAt", "variable" FROM "ProductBOMs";
DROP TABLE "ProductBOMs";
ALTER TABLE "new_ProductBOMs" RENAME TO "ProductBOMs";
CREATE TABLE "new_Products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Product',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "withTrim" TEXT NOT NULL DEFAULT 'Without Trim',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Products" ("archived", "createdAt", "description", "id", "name", "type", "updatedAt") SELECT "archived", "createdAt", "description", "id", "name", "type", "updatedAt" FROM "Products";
DROP TABLE "Products";
ALTER TABLE "new_Products" RENAME TO "Products";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MasterParts_partNumber_key" ON "MasterParts"("partNumber");
