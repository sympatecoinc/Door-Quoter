import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import { generatePartsFromProject, createSalesOrderParts, reserveInventory } from '@/lib/sales-order-parts'
import { createQBEstimate } from '@/lib/quickbooks'

/**
 * POST /api/sales-orders/[id]/confirm
 * Confirm a sales order:
 * 1. Validate SO is in DRAFT status
 * 2. Generate parts from project BOM
 * 3. Create SalesOrderPart records
 * 4. Reserve inventory (increment qtyReserved)
 * 5. Update SO status to CONFIRMED
 * 6. Create QuickBooks Estimate (if customer has QB ID)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const soId = parseInt(resolvedParams.id)

    if (isNaN(soId)) {
      return NextResponse.json(
        { error: 'Invalid sales order ID' },
        { status: 400 }
      )
    }

    // Get the sales order with project
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: {
        customer: true,
        project: true,
        lines: true,
        parts: true
      }
    })

    if (!salesOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      )
    }

    // Validate status - must be DRAFT to confirm
    if (salesOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot confirm order in ${salesOrder.status} status. Only DRAFT orders can be confirmed.` },
        { status: 400 }
      )
    }

    // Must have a linked project to generate parts
    if (!salesOrder.projectId) {
      return NextResponse.json(
        { error: 'Sales order must have a linked project to generate parts' },
        { status: 400 }
      )
    }

    // Check if parts already exist (prevent duplicate generation)
    if (salesOrder.parts.length > 0) {
      return NextResponse.json(
        { error: 'Parts have already been generated for this order' },
        { status: 400 }
      )
    }

    // Parse request body for options
    let options: { skipReservation?: boolean; forceConfirm?: boolean } = {}
    try {
      const body = await request.json()
      options = body || {}
    } catch {
      // No body provided, use defaults
    }

    // Generate parts from project BOM
    // Pass cookies for authentication on internal API calls
    const cookieHeader = request.headers.get('cookie') || ''
    const { parts, availability, hasShortages } = await generatePartsFromProject(salesOrder.projectId, cookieHeader)

    // If there are shortages and forceConfirm is not set, return availability info
    if (hasShortages && !options.forceConfirm) {
      return NextResponse.json({
        success: false,
        requiresConfirmation: true,
        message: 'Some parts have insufficient inventory',
        availability,
        shortages: availability.filter(a => a.shortage > 0)
      }, { status: 200 })
    }

    // Create SalesOrderPart records
    const partsCreated = await createSalesOrderParts(soId, parts)

    // Reserve inventory (unless skipped)
    if (!options.skipReservation) {
      await reserveInventory(soId)
    }

    // Update sales order status to CONFIRMED and set balance to totalAmount
    const updatedSO = await prisma.salesOrder.update({
      where: { id: soId },
      data: {
        status: 'CONFIRMED',
        balance: salesOrder.totalAmount,
      },
      include: {
        customer: true,
        project: true,
        lines: true,
        parts: {
          include: {
            masterPart: {
              include: {
                binLocationRef: true
              }
            }
          }
        }
      }
    })

    // Create QuickBooks Estimate if customer has QB ID
    let quickbooksEstimateId: string | null = null
    if (salesOrder.customer.quickbooksId) {
      try {
        const estimate = await createQBEstimate(updatedSO)
        quickbooksEstimateId = estimate?.Id || null

        // Update SO with QB estimate ID
        if (quickbooksEstimateId) {
          await prisma.salesOrder.update({
            where: { id: soId },
            data: {
              quickbooksId: quickbooksEstimateId,
              lastSyncedAt: new Date()
            }
          })
        }
      } catch (qbError) {
        console.error('Failed to create QuickBooks Estimate:', qbError)
        // Don't fail the confirmation, just log the error
      }
    }

    // Auto-advance: QUOTE_ACCEPTED → ACTIVE when SO is confirmed
    if (salesOrder.projectId && salesOrder.project?.status === ProjectStatus.QUOTE_ACCEPTED) {
      await prisma.$transaction([
        prisma.project.update({
          where: { id: salesOrder.projectId },
          data: { status: ProjectStatus.ACTIVE }
        }),
        prisma.projectStatusHistory.create({
          data: {
            projectId: salesOrder.projectId,
            status: ProjectStatus.ACTIVE,
            changedBy: 'System (SO Confirmed)'
          }
        })
      ])
    }

    return NextResponse.json({
      success: true,
      salesOrder: updatedSO,
      partsCreated,
      availability,
      hasShortages,
      quickbooksEstimateId
    })
  } catch (error) {
    console.error('Error confirming sales order:', error)
    return NextResponse.json(
      { error: 'Failed to confirm sales order' },
      { status: 500 }
    )
  }
}
