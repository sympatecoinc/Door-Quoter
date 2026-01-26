import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import {
  getStoredRealmId,
  fetchAllQBPurchaseOrders,
  qbPOToLocal,
  pushPOToQB,
  pushVendorToQB,
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
        // Auto-push vendor to QB if not synced
        if (!po.vendor?.quickbooksId) {
          if (!po.vendor) {
            results.errors.push(`Skipped PO ${po.poNumber}: No vendor assigned`)
            continue
          }
          console.log(`[QB 2-Way Sync] Vendor "${po.vendor.displayName}" not synced - pushing to QB first...`)
          try {
            await pushVendorToQB(po.vendor.id)
            console.log(`[QB 2-Way Sync] Vendor "${po.vendor.displayName}" synced to QuickBooks`)
          } catch (vendorError) {
            results.errors.push(`Skipped PO ${po.poNumber}: Failed to sync vendor "${po.vendor.displayName}" - ${vendorError instanceof Error ? vendorError.message : 'Unknown error'}`)
            continue
          }
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

        // Check if PO exists locally by quickbooksId
        const existingPO = await prisma.purchaseOrder.findUnique({
          where: { quickbooksId: qbPO.Id }
        })

        console.log(`[QB Sync] Processing QB PO ${qbPO.DocNumber || qbPO.Id}: existingPO=${existingPO ? `found (id=${existingPO.id}, status=${existingPO.status})` : 'NOT FOUND'}`)

        const localData = qbPOToLocal(qbPO, vendor.id)

        // Map QB PO status to local status
        const qbMappedStatus = mapQBStatusToLocal(qbPO)

        if (existingPO) {
          // Update existing PO
          // Only override local status if QB explicitly indicates closed/complete
          const qbIndicatesClosed = qbPO.ManuallyClosed === true || qbPO.POStatus === 'Closed'
          const finalStatus = qbIndicatesClosed ? qbMappedStatus : existingPO.status

          console.log(`[QB Sync] Updating existing PO ${existingPO.poNumber}:`, {
            qbId: qbPO.Id,
            qbManuallyClosed: qbPO.ManuallyClosed,
            qbPOStatus: qbPO.POStatus,
            qbIndicatesClosed,
            existingStatus: existingPO.status,
            finalStatus
          })

          // Remove status from localData to avoid accidental override
          const { status: _ignoredStatus, ...localDataWithoutStatus } = localData as any

          await prisma.purchaseOrder.update({
            where: { id: existingPO.id },
            data: {
              ...localDataWithoutStatus,
              // Don't overwrite local-only fields
              poNumber: existingPO.poNumber,
              createdById: existingPO.createdById,
              // Explicitly set status
              status: finalStatus
            }
          })

          // Sync line items
          await syncPOLines(existingPO.id, qbPO)

          results.updated++
        } else {
          // Create new PO from QuickBooks (not created locally first)
          const poNumber = qbPO.DocNumber || `QB-${qbPO.Id}`

          // Check for duplicate poNumber
          const existingByNumber = await prisma.purchaseOrder.findUnique({
            where: { poNumber }
          })

          console.log(`[QB Sync] Creating new PO from QB: ${poNumber}, status: ${qbMappedStatus}`)

          const newPO = await prisma.purchaseOrder.create({
            data: {
              ...localData,
              poNumber: existingByNumber ? `${poNumber}-QB` : poNumber,
              status: qbMappedStatus,
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: qbMappedStatus,
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

  // Process lines from QB - handle both ItemBasedExpenseLineDetail and AccountBasedExpenseLineDetail
  let lineNum = 0
  for (const qbLine of qbPO.Line) {
    // Skip subtotal/summary lines that don't represent actual line items
    if (qbLine.DetailType !== 'ItemBasedExpenseLineDetail' &&
        qbLine.DetailType !== 'AccountBasedExpenseLineDetail') {
      continue
    }

    lineNum++

    let quickbooksItemId: number | null = null
    let itemRefId: string | null = null
    let itemRefName: string | null = null
    let quantity = 1
    let unitPrice = 0

    if (qbLine.DetailType === 'ItemBasedExpenseLineDetail') {
      const detail = qbLine.ItemBasedExpenseLineDetail

      // Try to find matching QB Item locally
      if (detail?.ItemRef?.value) {
        const qbItem = await prisma.quickBooksItem.findUnique({
          where: { quickbooksId: detail.ItemRef.value }
        })
        quickbooksItemId = qbItem?.id || null
        itemRefId = detail.ItemRef.value
        itemRefName = detail.ItemRef.name || null
      }

      quantity = detail?.Qty || 1
      unitPrice = detail?.UnitPrice || 0
    } else if (qbLine.DetailType === 'AccountBasedExpenseLineDetail') {
      // Account-based lines don't store quantity/unit price in QB
      // We'll use defaults here, but preserve existing values if the line already exists
      quantity = 1
      unitPrice = qbLine.Amount || 0
    }

    // Find existing line by lineNum BEFORE building lineData
    // so we can preserve quantity/price for account-based lines
    const existingLine = currentLines.find(l => l.lineNum === lineNum)

    // For account-based lines, preserve the original quantity, unit price, and amount
    // since QB doesn't store these values separately
    let amount = qbLine.Amount || 0
    if (qbLine.DetailType === 'AccountBasedExpenseLineDetail' && existingLine) {
      quantity = existingLine.quantity
      unitPrice = existingLine.unitPrice
      amount = existingLine.amount || (quantity * unitPrice)
    }

    const lineData = {
      lineNum,
      quickbooksItemId,
      itemRefId,
      itemRefName,
      description: qbLine.Description || null,
      quantity,
      unitPrice,
      amount,
      quantityReceived: 0,
      quantityRemaining: quantity
    }

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
