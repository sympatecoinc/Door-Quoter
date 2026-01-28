-- CreateTable: Portal for subdomain-based access portals
CREATE TABLE IF NOT EXISTS "Portals" (
    "id" SERIAL NOT NULL,
    "subdomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tabs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultTab" TEXT,
    "headerTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Portals_subdomain_key" ON "Portals"("subdomain");
