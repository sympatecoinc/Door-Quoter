import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSalesOrderFromProject } from '@/lib/sales-order'
import { releaseInventory } from '@/lib/sales-order-parts'

// POST - Void the old Sales Order and create a new one from this project revision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    const { previousSalesOrderId, userId } = await request.json()

    if (!previousSalesOrderId) {
      return NextResponse.json(
        { error: 'previousSalesOrderId is required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Verify the previous SO exists and is active
      const previousSO = await tx.salesOrder.findUnique({
        where: { id: previousSalesOrderId },
        select: { id: true, status: true, orderNumber: true, quickbooksId: true }
      })

      if (!previousSO) {
        return { success: false, error: 'Previous sales order not found' }
      }

      if (previousSO.status === 'VOIDED' || previousSO.status === 'CANCELLED') {
        return { success: false, error: 'Previous sales order is already voided or cancelled' }
      }

      // Check for in-flight parts (PICKED/PACKED/SHIPPED) — block if any exist
      const inFlightCount = await tx.salesOrderPart.count({
        where: {
          salesOrderId: previousSalesOrderId,
          status: { in: ['PICKED', 'PACKED', 'SHIPPED'] }
        }
      })

      if (inFlightCount > 0) {
        return {
          success: false,
          error: `Cannot void — ${inFlightCount} part(s) have entered fulfillment (picked/packed/shipped). Handle the existing SO manually before creating a revision.`
        }
      }

      // Release inventory reservations for RESERVED/PENDING parts
      await releaseInventory(previousSalesOrderId, tx)

      // Void the previous SO
      await tx.salesOrder.update({
        where: { id: previousSalesOrderId },
        data: { status: 'VOIDED' }
      })

      // Create new SO from this project
      const soResult = await createSalesOrderFromProject(tx, {
        projectId,
        userId: userId || null,
      })

      if (!soResult.success) {
        return { success: false, error: soResult.error }
      }

      return {
        success: true,
        salesOrder: soResult.salesOrder,
        voidedOrderNumber: previousSO.orderNumber,
        quickbooksId: previousSO.quickbooksId,
      }
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Void the QB Estimate if one exists (non-blocking, after transaction commits)
    let qbWarning: string | null = null
    if (result.quickbooksId) {
      try {
        const { getStoredRealmId, getQBEstimate, voidQBEstimate } = await import('@/lib/quickbooks')
        const realmId = await getStoredRealmId()
        if (realmId) {
          const qbEstimate = await getQBEstimate(realmId, result.quickbooksId)
          await voidQBEstimate(realmId, result.quickbooksId, qbEstimate.SyncToken!)
          console.log(`[QB Sync] Voided estimate ${result.voidedOrderNumber} in QuickBooks`)
        }
      } catch (qbError) {
        console.warn(`[QB Sync] Failed to void estimate ${result.voidedOrderNumber} in QB:`, qbError)
        qbWarning = `Sales order voided locally but QuickBooks void failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    return NextResponse.json({
      salesOrder: result.salesOrder,
      voidedOrderNumber: result.voidedOrderNumber,
      ...(qbWarning && { warning: qbWarning }),
    })
  } catch (error) {
    console.error('Error creating revised sales order:', error)
    return NextResponse.json(
      { error: 'Failed to create revised sales order' },
      { status: 500 }
    )
  }
}
