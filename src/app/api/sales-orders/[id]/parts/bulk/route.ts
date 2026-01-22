import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bulkUpdatePartStatus, getPartsSummary } from '@/lib/sales-order-parts'

/**
 * POST /api/sales-orders/[id]/parts/bulk
 * Bulk update multiple parts at once
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

    const body = await request.json()
    const { updates, userId } = body

    // updates should be an array of { partId, status, quantity? }
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      )
    }

    // Verify all parts belong to this sales order
    const partIds = updates.map(u => u.partId)
    const parts = await prisma.salesOrderPart.findMany({
      where: {
        id: { in: partIds },
        salesOrderId: soId
      }
    })

    if (parts.length !== partIds.length) {
      return NextResponse.json(
        { error: 'Some parts do not belong to this sales order' },
        { status: 400 }
      )
    }

    // Perform bulk update
    const updatedCount = await bulkUpdatePartStatus(updates, userId)

    // Get updated summary
    const summary = await getPartsSummary(soId)

    // Fetch updated parts
    const updatedParts = await prisma.salesOrderPart.findMany({
      where: { id: { in: partIds } },
      include: {
        masterPart: {
          include: { binLocationRef: true }
        },
        pickedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Calculate availability for each part
    const partsWithAvailability = updatedParts.map(part => {
      const onHand = part.masterPart?.qtyOnHand ?? 0
      const reserved = part.masterPart?.qtyReserved ?? 0
      const available = Math.max(0, onHand - reserved)

      return {
        ...part,
        availability: {
          onHand,
          reserved,
          available,
          binLocation: part.masterPart?.binLocationRef?.code ?? null
        }
      }
    })

    return NextResponse.json({
      success: true,
      updatedCount,
      parts: partsWithAvailability,
      summary
    })
  } catch (error) {
    console.error('Error bulk updating parts:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update parts' },
      { status: 500 }
    )
  }
}
