-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Panels" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openingId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "glassType" TEXT NOT NULL,
    "locking" TEXT NOT NULL,
    "swingDirection" TEXT NOT NULL DEFAULT 'None',
    "slidingDirection" TEXT NOT NULL DEFAULT 'Left',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Panels_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Openings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Panels" ("createdAt", "glassType", "height", "id", "locking", "openingId", "swingDirection", "type", "updatedAt", "width") SELECT "createdAt", "glassType", "height", "id", "locking", "openingId", "swingDirection", "type", "updatedAt", "width" FROM "Panels";
DROP TABLE "Panels";
ALTER TABLE "new_Panels" RENAME TO "Panels";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
