import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoredRealmId, createQBItem, QBItem } from '@/lib/quickbooks'

// POST - Export a MasterPart to QuickBooks as an Item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const masterPartId = parseInt(id, 10)

    if (isNaN(masterPartId)) {
      return NextResponse.json(
        { error: 'Invalid MasterPart ID' },
        { status: 400 }
      )
    }

    // Check QuickBooks connection
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Please connect to QuickBooks first.' },
        { status: 400 }
      )
    }

    // Get the MasterPart
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId },
      include: {
        quickbooksItem: true,
        vendor: true
      }
    })

    if (!masterPart) {
      return NextResponse.json(
        { error: 'MasterPart not found' },
        { status: 404 }
      )
    }

    // Check if already linked to a QB Item
    if (masterPart.quickbooksItem) {
      return NextResponse.json({
        message: 'MasterPart is already linked to a QuickBooks Item',
        quickbooksItem: masterPart.quickbooksItem
      })
    }

    // Build the QB Item from MasterPart
    const qbItem: QBItem = {
      Name: masterPart.partNumber, // Use part number as name (must be unique in QB)
      Type: 'NonInventory', // NonInventory type doesn't require complex account setup
      Description: masterPart.description || masterPart.baseName,
      PurchaseDesc: masterPart.description || masterPart.baseName,
      PurchaseCost: masterPart.cost || 0,
      Active: true
    }

    // If there's a vendor with QB ID, set as preferred vendor
    if (masterPart.vendor?.quickbooksId) {
      qbItem.PrefVendorRef = {
        value: masterPart.vendor.quickbooksId,
        name: masterPart.vendor.displayName
      }
    }

    // Create the item in QuickBooks
    const createdQBItem = await createQBItem(realmId, qbItem)

    // Create local QuickBooksItem and link to MasterPart
    const localItem = await prisma.quickBooksItem.create({
      data: {
        quickbooksId: createdQBItem.Id!,
        syncToken: createdQBItem.SyncToken,
        name: createdQBItem.Name,
        sku: createdQBItem.Sku || null,
        description: createdQBItem.Description || null,
        type: createdQBItem.Type || 'NonInventory',
        active: createdQBItem.Active ?? true,
        unitPrice: createdQBItem.UnitPrice ?? null,
        purchaseCost: createdQBItem.PurchaseCost ?? null,
        purchaseDesc: createdQBItem.PurchaseDesc || null,
        prefVendorRefId: createdQBItem.PrefVendorRef?.value || null,
        prefVendorRefName: createdQBItem.PrefVendorRef?.name || null,
        masterPartId: masterPartId,
        lastSyncedAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'MasterPart exported to QuickBooks successfully',
      quickbooksItem: localItem
    })
  } catch (error) {
    console.error('Error exporting MasterPart to QuickBooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export to QuickBooks' },
      { status: 500 }
    )
  }
}
