-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('Draft', 'Sent', 'Acknowledged', 'Partial', 'Complete', 'Cancelled', 'On Hold');

-- CreateEnum
CREATE TYPE "SOStatus" AS ENUM ('Draft', 'Confirmed', 'Sent', 'Viewed', 'Partial', 'Paid', 'Partially Invoiced', 'Fully Invoiced', 'Overdue', 'Voided', 'Cancelled');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Sent', 'Viewed', 'Partial', 'Paid', 'Overdue', 'Voided');

-- CreateTable
CREATE TABLE "BinLocations" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinLocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksItems" (
    "id" SERIAL NOT NULL,
    "quickbooksId" TEXT NOT NULL,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unitPrice" DOUBLE PRECISION,
    "purchaseCost" DOUBLE PRECISION,
    "purchaseDesc" TEXT,
    "trackQtyOnHand" BOOLEAN NOT NULL DEFAULT false,
    "qtyOnHand" DOUBLE PRECISION,
    "reorderPoint" DOUBLE PRECISION,
    "incomeAccountRefId" TEXT,
    "expenseAccountRefId" TEXT,
    "assetAccountRefId" TEXT,
    "prefVendorRefId" TEXT,
    "prefVendorRefName" TEXT,
    "masterPartId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickBooksItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrders" (
    "id" SERIAL NOT NULL,
    "quickbooksId" TEXT,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "poNumber" TEXT NOT NULL,
    "docNumber" TEXT,
    "vendorId" INTEGER NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'Draft',
    "manuallyClosed" BOOLEAN NOT NULL DEFAULT false,
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "shipAddrLine1" TEXT,
    "shipAddrLine2" TEXT,
    "shipAddrCity" TEXT,
    "shipAddrState" TEXT,
    "shipAddrPostalCode" TEXT,
    "shipAddrCountry" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memo" TEXT,
    "privateNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLines" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "quickbooksItemId" INTEGER,
    "itemRefId" TEXT,
    "itemRefName" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POReceivings" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" INTEGER,
    "notes" TEXT,
    "qualityNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POReceivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POReceivingLines" (
    "id" SERIAL NOT NULL,
    "receivingId" INTEGER NOT NULL,
    "purchaseOrderLineId" INTEGER NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityDamaged" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityRejected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POReceivingLines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POStatusHistory" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "fromStatus" "POStatus",
    "toStatus" "POStatus" NOT NULL,
    "changedById" INTEGER,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrders" (
    "id" SERIAL NOT NULL,
    "quickbooksId" TEXT,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "orderNumber" TEXT NOT NULL,
    "docNumber" TEXT,
    "customerId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "status" "SOStatus" NOT NULL DEFAULT 'Draft',
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "shipDate" TIMESTAMP(3),
    "billAddrLine1" TEXT,
    "billAddrLine2" TEXT,
    "billAddrCity" TEXT,
    "billAddrState" TEXT,
    "billAddrPostalCode" TEXT,
    "billAddrCountry" TEXT,
    "shipAddrLine1" TEXT,
    "shipAddrLine2" TEXT,
    "shipAddrCity" TEXT,
    "shipAddrState" TEXT,
    "shipAddrPostalCode" TEXT,
    "shipAddrCountry" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerMemo" TEXT,
    "privateNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLines" (
    "id" SERIAL NOT NULL,
    "salesOrderId" INTEGER NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "itemRefId" TEXT,
    "itemRefName" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoices" (
    "id" SERIAL NOT NULL,
    "quickbooksId" TEXT,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "invoiceNumber" TEXT NOT NULL,
    "docNumber" TEXT,
    "customerId" INTEGER NOT NULL,
    "salesOrderId" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "shipDate" TIMESTAMP(3),
    "billAddrLine1" TEXT,
    "billAddrLine2" TEXT,
    "billAddrCity" TEXT,
    "billAddrState" TEXT,
    "billAddrPostalCode" TEXT,
    "billAddrCountry" TEXT,
    "shipAddrLine1" TEXT,
    "shipAddrLine2" TEXT,
    "shipAddrCity" TEXT,
    "shipAddrState" TEXT,
    "shipAddrPostalCode" TEXT,
    "shipAddrCountry" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerMemo" TEXT,
    "privateNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLines" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "lineNum" INTEGER NOT NULL DEFAULT 0,
    "itemRefId" TEXT,
    "itemRefName" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryNotifications" (
    "id" SERIAL NOT NULL,
    "masterPartId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryNotifications_pkey" PRIMARY KEY ("id")
);

-- AlterTable - Add QuickBooks fields to Customers
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "quickbooksId" TEXT;
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "syncToken" TEXT;
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

-- AlterTable - Add binLocationId to ExtrusionVariants
ALTER TABLE "ExtrusionVariants" ADD COLUMN IF NOT EXISTS "binLocationId" INTEGER;

-- AlterTable - Add binLocationId to MasterParts
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "binLocationId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BinLocations_code_key" ON "BinLocations"("code");
CREATE UNIQUE INDEX "BinLocations_accessToken_key" ON "BinLocations"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksItems_quickbooksId_key" ON "QuickBooksItems"("quickbooksId");
CREATE UNIQUE INDEX "QuickBooksItems_masterPartId_key" ON "QuickBooksItems"("masterPartId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrders_quickbooksId_key" ON "PurchaseOrders"("quickbooksId");
CREATE UNIQUE INDEX "PurchaseOrders_poNumber_key" ON "PurchaseOrders"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrders_quickbooksId_key" ON "SalesOrders"("quickbooksId");
CREATE UNIQUE INDEX "SalesOrders_orderNumber_key" ON "SalesOrders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoices_quickbooksId_key" ON "Invoices"("quickbooksId");
CREATE UNIQUE INDEX "Invoices_invoiceNumber_key" ON "Invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Customers_quickbooksId_key" ON "Customers"("quickbooksId");

-- AddForeignKey
ALTER TABLE "QuickBooksItems" ADD CONSTRAINT "QuickBooksItems_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrders" ADD CONSTRAINT "PurchaseOrders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrders" ADD CONSTRAINT "PurchaseOrders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLines" ADD CONSTRAINT "PurchaseOrderLines_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLines" ADD CONSTRAINT "PurchaseOrderLines_quickbooksItemId_fkey" FOREIGN KEY ("quickbooksItemId") REFERENCES "QuickBooksItems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POReceivings" ADD CONSTRAINT "POReceivings_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POReceivings" ADD CONSTRAINT "POReceivings_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POReceivingLines" ADD CONSTRAINT "POReceivingLines_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "POReceivings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POReceivingLines" ADD CONSTRAINT "POReceivingLines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POStatusHistory" ADD CONSTRAINT "POStatusHistory_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POStatusHistory" ADD CONSTRAINT "POStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrders" ADD CONSTRAINT "SalesOrders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrders" ADD CONSTRAINT "SalesOrders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrders" ADD CONSTRAINT "SalesOrders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLines" ADD CONSTRAINT "SalesOrderLines_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoices" ADD CONSTRAINT "Invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoices" ADD CONSTRAINT "Invoices_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoices" ADD CONSTRAINT "Invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLines" ADD CONSTRAINT "InvoiceLines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryNotifications" ADD CONSTRAINT "InventoryNotifications_masterPartId_fkey" FOREIGN KEY ("masterPartId") REFERENCES "MasterParts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtrusionVariants" ADD CONSTRAINT "ExtrusionVariants_binLocationId_fkey" FOREIGN KEY ("binLocationId") REFERENCES "BinLocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterParts" ADD CONSTRAINT "MasterParts_binLocationId_fkey" FOREIGN KEY ("binLocationId") REFERENCES "BinLocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
