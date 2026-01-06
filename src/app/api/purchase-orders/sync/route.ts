import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import {
  getStoredRealmId,
  fetchAllQBPurchaseOrders,
  qbPOToLocal,
  pushPOToQB,
  QBPurchaseOrder,
  QBPOLine
} from '@/lib/quickbooks'

// GET - 2-way sync: Push local POs to QB, then pull QB POs to local
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Please connect to QuickBooks first.' },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      pushed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Step 1: Push local POs without quickbooksId to QuickBooks
    const localOnlyPOs = await prisma.purchaseOrder.findMany({
      where: { quickbooksId: null },
      include: { vendor: true }
    })

    console.log(`[QB 2-Way Sync] Found ${localOnlyPOs.length} local POs to push to QuickBooks`)

    for (const po of localOnlyPOs) {
      try {
        // Skip if vendor is not synced to QB
        if (!po.vendor?.quickbooksId) {
          results.errors.push(`Skipped PO ${po.poNumber}: Vendor not synced to QuickBooks`)
          continue
        }
        await pushPOToQB(po.id)
        results.pushed++
        console.log(`[QB 2-Way Sync] Pushed PO "${po.poNumber}" to QuickBooks`)
      } catch (error) {
        const errorMsg = `Failed to push PO ${po.poNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    // Step 2: Pull POs from QuickBooks to local
    const qbPOs = await fetchAllQBPurchaseOrders(realmId)

    for (const qbPO of qbPOs) {
      try {
        // Get vendor by QB ID
        const vendorQBId = qbPO.VendorRef?.value
        if (!vendorQBId) {
          results.skipped++
          continue
        }

        const vendor = await prisma.vendor.findUnique({
          where: { quickbooksId: vendorQBId }
        })

        if (!vendor) {
          // Vendor not synced yet - skip this PO
          results.errors.push(`Skipped PO ${qbPO.DocNumber || qbPO.Id}: Vendor ${vendorQBId} not found locally. Sync vendors first.`)
          results.skipped++
          continue
        }

        // Check if PO exists locally
        const existingPO = await prisma.purchaseOrder.findUnique({
          where: { quickbooksId: qbPO.Id }
        })

        const localData = qbPOToLocal(qbPO, vendor.id)

        // Map QB PO status to local status
        const status = mapQBStatusToLocal(qbPO)
        localData.status = status

        if (existingPO) {
          // Update existing PO
          await prisma.purchaseOrder.update({
            where: { id: existingPO.id },
            data: {
              ...localData,
              // Don't overwrite local-only fields
              poNumber: existingPO.poNumber,
              createdById: existingPO.createdById
            }
          })

          // Sync line items
          await syncPOLines(existingPO.id, qbPO)

          results.updated++
        } else {
          // Create new PO
          const poNumber = qbPO.DocNumber || `QB-${qbPO.Id}`

          // Check for duplicate poNumber
          const existingByNumber = await prisma.purchaseOrder.findUnique({
            where: { poNumber }
          })

          const newPO = await prisma.purchaseOrder.create({
            data: {
              ...localData,
              poNumber: existingByNumber ? `${poNumber}-QB` : poNumber,
              status,
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: status,
                  notes: 'Synced from QuickBooks'
                }
              }
            }
          })

          // Sync line items
          await syncPOLines(newPO.id, qbPO)

          results.created++
        }
      } catch (error) {
        const errorMsg = `Failed to sync PO ${qbPO.DocNumber || qbPO.Id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log(`[QB 2-Way Sync] Complete: Pushed ${results.pushed}, Created ${results.created}, Updated ${results.updated}`)

    return NextResponse.json({
      message: `2-way sync complete. Pushed: ${results.pushed}, Created: ${results.created}, Updated: ${results.updated}`,
      ...results
    })
  } catch (error) {
    console.error('Error syncing purchase orders:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync purchase orders' },
      { status: 500 }
    )
  }
}

// Helper function to map QB PO status to local status
function mapQBStatusToLocal(qbPO: QBPurchaseOrder): POStatus {
  if (qbPO.ManuallyClosed) {
    return 'COMPLETE'
  }

  // QB doesn't have detailed status like we do, so we use heuristics
  // POStatus in QB is typically just 'Open' or 'Closed'
  if (qbPO.POStatus === 'Closed') {
    return 'COMPLETE'
  }

  // Default to SENT for QB POs since they've been created in QB
  return 'SENT'
}

// Helper function to sync PO lines from QB
async function syncPOLines(poId: number, qbPO: QBPurchaseOrder) {
  if (!qbPO.Line || qbPO.Line.length === 0) {
    return
  }

  // Get current lines
  const currentLines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrderId: poId }
  })

  // Delete lines that don't exist in QB anymore (based on lineNum)
  // For simplicity, we'll just update/create based on line order

  let lineNum = 0
  for (const qbLine of qbPO.Line) {
    if (qbLine.DetailType !== 'ItemBasedExpenseLineDetail') {
      continue // Skip non-item lines (like subtotal lines)
    }

    lineNum++
    const detail = qbLine.ItemBasedExpenseLineDetail

    // Try to find matching QB Item locally
    let quickbooksItemId: number | null = null
    if (detail?.ItemRef?.value) {
      const qbItem = await prisma.quickBooksItem.findUnique({
        where: { quickbooksId: detail.ItemRef.value }
      })
      quickbooksItemId = qbItem?.id || null
    }

    const lineData = {
      lineNum,
      quickbooksItemId,
      itemRefId: detail?.ItemRef?.value || null,
      itemRefName: detail?.ItemRef?.name || null,
      description: qbLine.Description || null,
      quantity: detail?.Qty || 1,
      unitPrice: detail?.UnitPrice || 0,
      amount: qbLine.Amount || 0,
      quantityReceived: 0,
      quantityRemaining: detail?.Qty || 1
    }

    // Find existing line by lineNum
    const existingLine = currentLines.find(l => l.lineNum === lineNum)

    if (existingLine) {
      await prisma.purchaseOrderLine.update({
        where: { id: existingLine.id },
        data: {
          ...lineData,
          // Preserve receiving data
          quantityReceived: existingLine.quantityReceived,
          quantityRemaining: lineData.quantity - existingLine.quantityReceived
        }
      })
    } else {
      await prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: poId,
          ...lineData
        }
      })
    }
  }

  // Remove extra lines that were deleted in QB
  const linesToDelete = currentLines.filter(l => l.lineNum > lineNum)
  if (linesToDelete.length > 0) {
    await prisma.purchaseOrderLine.deleteMany({
      where: {
        id: { in: linesToDelete.map(l => l.id) }
      }
    })
  }
}
