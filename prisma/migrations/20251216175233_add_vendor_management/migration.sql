-- CreateTable
CREATE TABLE "Vendors" (
    "id" SERIAL NOT NULL,
    "quickbooksId" TEXT,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "givenName" TEXT,
    "familyName" TEXT,
    "printOnCheckName" TEXT,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "alternatePhone" TEXT,
    "mobile" TEXT,
    "fax" TEXT,
    "website" TEXT,
    "billAddressLine1" TEXT,
    "billAddressLine2" TEXT,
    "billAddressCity" TEXT,
    "billAddressState" TEXT,
    "billAddressZip" TEXT,
    "billAddressCountry" TEXT,
    "taxIdentifier" TEXT,
    "acctNum" TEXT,
    "vendor1099" BOOLEAN NOT NULL DEFAULT false,
    "balance" DOUBLE PRECISION,
    "termRefId" TEXT,
    "termRefName" TEXT,
    "notes" TEXT,
    "category" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContacts" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksTokens" (
    "id" SERIAL NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickBooksTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_quickbooksId_key" ON "Vendors"("quickbooksId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksTokens_realmId_key" ON "QuickBooksTokens"("realmId");

-- AddForeignKey
ALTER TABLE "VendorContacts" ADD CONSTRAINT "VendorContacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
