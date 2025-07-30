-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductBOMs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "partType" TEXT NOT NULL DEFAULT 'Hardware',
    "partName" TEXT NOT NULL,
    "description" TEXT,
    "materialType" TEXT NOT NULL,
    "formula" TEXT,
    "variable" TEXT,
    "unit" TEXT,
    "stockLength" REAL,
    "partNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBOMs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductBOMs" ("createdAt", "formula", "id", "materialType", "partName", "productId", "updatedAt", "variable") SELECT "createdAt", "formula", "id", "materialType", "partName", "productId", "updatedAt", "variable" FROM "ProductBOMs";
DROP TABLE "ProductBOMs";
ALTER TABLE "new_ProductBOMs" RENAME TO "ProductBOMs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
