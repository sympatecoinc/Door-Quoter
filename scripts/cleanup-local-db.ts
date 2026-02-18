import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupLocalDb() {
  // Safety check: only run against localhost
  const dbUrl = process.env.DATABASE_URL || ''
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    console.error('SAFETY CHECK FAILED: DATABASE_URL does not point to localhost.')
    console.error('This script is only for local development databases.')
    console.error('DATABASE_URL:', dbUrl.replace(/:[^@]+@/, ':****@'))
    process.exit(1)
  }

  console.log('Starting local database cleanup...')
  console.log('Database:', dbUrl.replace(/:[^@]+@/, ':****@'))
  console.log('')

  // Use a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // --- DELETE transactional data (child tables first) ---

    // Work Orders
    let r = await tx.$executeRawUnsafe('DELETE FROM "WorkOrderItems"')
    console.log(`  Deleted ${r} rows from WorkOrderItems`)
    r = await tx.$executeRawUnsafe('DELETE FROM "WorkOrderStageHistory"')
    console.log(`  Deleted ${r} rows from WorkOrderStageHistory`)
    r = await tx.$executeRawUnsafe('DELETE FROM "WorkOrders"')
    console.log(`  Deleted ${r} rows from WorkOrders`)

    // Change Orders (must be before SalesOrders and Projects)
    r = await tx.$executeRawUnsafe('DELETE FROM "ChangeOrderLines"')
    console.log(`  Deleted ${r} rows from ChangeOrderLines`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ChangeOrders"')
    console.log(`  Deleted ${r} rows from ChangeOrders`)

    // Sales Orders
    r = await tx.$executeRawUnsafe('DELETE FROM "SalesOrderParts"')
    console.log(`  Deleted ${r} rows from SalesOrderParts`)
    r = await tx.$executeRawUnsafe('DELETE FROM "SalesOrderLines"')
    console.log(`  Deleted ${r} rows from SalesOrderLines`)
    r = await tx.$executeRawUnsafe('DELETE FROM "SalesOrders"')
    console.log(`  Deleted ${r} rows from SalesOrders`)

    // Invoices
    r = await tx.$executeRawUnsafe('DELETE FROM "InvoiceLines"')
    console.log(`  Deleted ${r} rows from InvoiceLines`)
    r = await tx.$executeRawUnsafe('DELETE FROM "Invoices"')
    console.log(`  Deleted ${r} rows from Invoices`)

    // Purchase Orders
    r = await tx.$executeRawUnsafe('DELETE FROM "POReceivingLines"')
    console.log(`  Deleted ${r} rows from POReceivingLines`)
    r = await tx.$executeRawUnsafe('DELETE FROM "POReceivings"')
    console.log(`  Deleted ${r} rows from POReceivings`)
    r = await tx.$executeRawUnsafe('DELETE FROM "POStatusHistory"')
    console.log(`  Deleted ${r} rows from POStatusHistory`)
    r = await tx.$executeRawUnsafe('DELETE FROM "PurchaseOrderLines"')
    console.log(`  Deleted ${r} rows from PurchaseOrderLines`)
    r = await tx.$executeRawUnsafe('DELETE FROM "PurchaseOrders"')
    console.log(`  Deleted ${r} rows from PurchaseOrders`)

    // Projects and children
    r = await tx.$executeRawUnsafe('DELETE FROM "OpeningPresetPartInstances"')
    console.log(`  Deleted ${r} rows from OpeningPresetPartInstances`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ComponentInstances"')
    console.log(`  Deleted ${r} rows from ComponentInstances`)
    r = await tx.$executeRawUnsafe('DELETE FROM "Panels"')
    console.log(`  Deleted ${r} rows from Panels`)
    r = await tx.$executeRawUnsafe('DELETE FROM "Openings"')
    console.log(`  Deleted ${r} rows from Openings`)
    r = await tx.$executeRawUnsafe('DELETE FROM "BOMs"')
    console.log(`  Deleted ${r} rows from BOMs`)
    r = await tx.$executeRawUnsafe('DELETE FROM "QuoteAttachments"')
    console.log(`  Deleted ${r} rows from QuoteAttachments`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ProjectStatusHistory"')
    console.log(`  Deleted ${r} rows from ProjectStatusHistory`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ProjectContacts"')
    console.log(`  Deleted ${r} rows from ProjectContacts`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ProjectNotes"')
    console.log(`  Deleted ${r} rows from ProjectNotes`)
    r = await tx.$executeRawUnsafe('DELETE FROM "QuoteVersions"')
    console.log(`  Deleted ${r} rows from QuoteVersions`)
    r = await tx.$executeRawUnsafe('DELETE FROM "FieldVerificationUploads"')
    console.log(`  Deleted ${r} rows from FieldVerificationUploads`)
    r = await tx.$executeRawUnsafe('DELETE FROM "Projects"')
    console.log(`  Deleted ${r} rows from Projects`)

    // Misc transactional data
    r = await tx.$executeRawUnsafe('DELETE FROM "InventoryNotifications"')
    console.log(`  Deleted ${r} rows from InventoryNotifications`)
    r = await tx.$executeRawUnsafe('DELETE FROM "ClickUpSyncLogs"')
    console.log(`  Deleted ${r} rows from ClickUpSyncLogs`)
    r = await tx.$executeRawUnsafe('DELETE FROM "PriceHistory"')
    console.log(`  Deleted ${r} rows from PriceHistory`)

    console.log('')

    // --- UPDATE inventory to baseline ---
    r = await tx.$executeRawUnsafe('UPDATE "MasterParts" SET "qtyOnHand" = 100, "qtyReserved" = 0')
    console.log(`  Reset inventory on ${r} MasterParts (qtyOnHand=100, qtyReserved=0)`)
    r = await tx.$executeRawUnsafe('UPDATE "ExtrusionVariants" SET "qtyOnHand" = 100, "qtyReserved" = 0')
    console.log(`  Reset inventory on ${r} ExtrusionVariants (qtyOnHand=100, qtyReserved=0)`)
  })

  console.log('')
  console.log('Local database cleanup complete!')
}

cleanupLocalDb()
  .catch((error) => {
    console.error('Cleanup failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
