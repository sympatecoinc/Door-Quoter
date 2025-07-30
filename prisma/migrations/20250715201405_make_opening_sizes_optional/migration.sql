-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Openings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "roughWidth" REAL,
    "roughHeight" REAL,
    "finishedWidth" REAL,
    "finishedHeight" REAL,
    "price" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Openings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Openings" ("createdAt", "finishedHeight", "finishedWidth", "id", "name", "price", "projectId", "roughHeight", "roughWidth", "updatedAt") SELECT "createdAt", "finishedHeight", "finishedWidth", "id", "name", "price", "projectId", "roughHeight", "roughWidth", "updatedAt" FROM "Openings";
DROP TABLE "Openings";
ALTER TABLE "new_Openings" RENAME TO "Openings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
